import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';
import { AuthService } from 'src/auth/auth.service';
import { BusinessSectorsService } from 'src/common/business-sectors/business-sectors.service';
import { CompanyUsersService } from 'src/companies/company-user.service';
import { CompanyUser } from 'src/companies/models/company-user.model';
import { MailsService } from 'src/mails/mails.service';
import { userProfileAttributes } from 'src/messaging/messaging.attributes';
import { Conversation } from 'src/messaging/models';
import { Organization } from 'src/organizations/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfilesAttributes } from 'src/user-profiles/models/user-profile.attributes';
import { getUserProfileOrder } from 'src/user-profiles/models/user-profile.include';
import {
  RecommendationDto,
  RecommendationsDto,
} from 'src/user-profiles/recommendations/dto/recommendations.dto';
import { UserProfileRecommendationsService } from 'src/user-profiles/recommendations/user-profile-recommendations-ai.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { FilterParams } from 'src/utils/types';
import { UpdateUserDto } from './dto';
import { User, UserAttributes } from './models';
import { PublicUserAttributes } from './models/user.attributes';
import {
  getUserCandidatOrder,
  getUserProfileRecentlyUpdatedOrder,
  UserIncludes,
} from './models/user.include';
import {
  MemberFilterKey,
  OnboardingStatus,
  UserRole,
  UserRoles,
} from './users.types';

import {
  getCommonMembersFilterOptions,
  userSearchQueryRaw,
} from './users.utils';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type NoResponseToFirstMessageResultDto = {
  id: string;
  user: User;
  recommendations: RecommendationDto[];
  addressees: User[];
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private mailsService: MailsService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
    @Inject(forwardRef(() => CompanyUsersService))
    private companyUsersService: CompanyUsersService,
    private businessSectorsService: BusinessSectorsService,
    private queuesService: QueuesService,
    @Inject(forwardRef(() => UserProfilesService))
    private userProfilesService: UserProfilesService,
    @Inject(forwardRef(() => UserProfileRecommendationsService))
    private userProfileRecommendationsService: UserProfileRecommendationsService
  ) {}

  async create(createUserDto: Partial<User>) {
    return this.userModel.create(createUserDto, { hooks: true });
  }

  async findOne(id: string) {
    return this.userModel.findByPk(id, {
      attributes: [...UserAttributes],
    });
  }

  async findOneByMail(email: string) {
    return this.userModel.findOne({
      where: { email: email.toLowerCase() },
      attributes: [...UserAttributes],
    });
  }

  async findOneByMailWithRelations(email: string) {
    return this.userModel.findOne({
      where: { email: email.toLowerCase() },
      attributes: [...UserAttributes],
      include: UserIncludes(),
      order: getUserCandidatOrder(),
    });
  }

  async findOneWithRelations(id: string): Promise<User> {
    return this.userModel.findByPk(id, {
      attributes: [...UserAttributes],
      include: UserIncludes(),
      order: getUserCandidatOrder(),
    });
  }

  async findByEmailsWithRelations(emails: string[]) {
    return this.userModel.findAll({
      where: {
        email: {
          [Op.in]: emails.map((email) => email.toLowerCase()),
        },
      },
      attributes: [...UserAttributes],
      include: UserIncludes(),
      order: getUserCandidatOrder(),
    });
  }

  async findByIdsWithRelations(ids: string[]) {
    return this.userModel.findAll({
      where: {
        id: {
          [Op.in]: ids,
        },
      },
      attributes: [...UserAttributes],
      include: UserIncludes(),
      order: getUserCandidatOrder(),
    });
  }

  async findOneForJwtPayload(id: string): Promise<User> {
    return this.userModel.findByPk(id, {
      attributes: ['id', 'email', 'role', 'isEmailVerified', 'deletedAt'],
    });
  }

  async findOneForJwtPayloadByEmail(email: string): Promise<User> {
    return this.userModel.findOne({
      where: { email: email.toLowerCase() },
      attributes: ['id', 'email', 'role', 'isEmailVerified', 'deletedAt'],
    });
  }

  async findOneWithCompanyUsers(id: string) {
    return this.userModel.findByPk(id, {
      attributes: [...UserAttributes],
      include: [
        {
          model: CompanyUser,
          as: 'companyUsers',
          attributes: ['isAdmin', 'role', 'companyId'],
          required: false,
        },
      ],
    });
  }

  async linkCompany(
    user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'zone'>,
    companyId: string | null
  ) {
    return await this.companyUsersService.linkUserToCompany(user, companyId);
  }

  /**
   * Find all users by their emails
   * @param emails Array of emails
   * @returns Array of users
   */
  async findAllByMail(emails: string[]) {
    return this.userModel.findAll({
      where: {
        email: {
          [Op.in]: emails.map((email) => email.toLowerCase()),
        },
      },
      attributes: [...UserAttributes],
      include: [
        {
          model: UserProfile,
          as: 'userProfile',
          attributes: UserProfilesAttributes,
          order: getUserProfileOrder(),
        },
      ],
    });
  }

  async findOneComplete(id: string) {
    return this.userModel.findByPk(id, {
      include: UserIncludes(),
    });
  }

  async findAllCandidateMembers(
    params: {
      limit: number;
      offset: number;
      search: string;
    } & FilterParams<MemberFilterKey>
  ): Promise<User[]> {
    const { limit, offset, search, ...restParams } = params;

    const allBusinessSectors = await this.businessSectorsService.all();
    const { filterOptions, replacements } = getCommonMembersFilterOptions(
      {
        ...restParams,
        role: [UserRoles.CANDIDATE],
      },
      allBusinessSectors
    );

    const candidatesIds: { userId: string }[] =
      await this.userModel.sequelize.query(
        `
        SELECT 
          "User"."id" as "userId"

        FROM "Users" AS "User"

        LEFT OUTER JOIN "User_Candidats" AS "candidat" 
          ON "User"."id" = "candidat"."candidatId"
        LEFT OUTER JOIN "Users" AS "candidat->coach"
          ON "candidat"."coachId" = "candidat->coach"."id" 
          AND ("candidat->coach"."deletedAt" IS NULL)
        LEFT OUTER JOIN "Organizations" AS "candidat->coach->organization"
          ON "candidat->coach"."OrganizationId" = "candidat->coach->organization"."id"
        LEFT OUTER JOIN "Organizations" AS "organization"
          ON "User"."OrganizationId" = "organization"."id"
        LEFT OUTER JOIN "UserProfiles" AS "userProfile"
          ON "User"."id" = "userProfile"."userId"
        LEFT OUTER JOIN "UserProfileSectorOccupations" AS "userProfile->sectorOccupations"
          ON "userProfile"."id" = "userProfile->sectorOccupations"."userProfileId"
        LEFT OUTER JOIN "BusinessSectors" AS "userProfile->sectorOccupations->businessSectors"
          ON "userProfile->sectorOccupations"."businessSectorId" = "userProfile->sectorOccupations->businessSectors"."id"

        WHERE 
          "User"."deletedAt" IS NULL
          AND ${filterOptions.join(' AND ')} ${
          search ? `AND ${userSearchQueryRaw(search, true)}` : ''
        }

        GROUP BY "User"."id"
        ORDER BY "User"."firstName" ASC
        LIMIT ${limit}
        OFFSET ${offset}
        `,
        {
          type: QueryTypes.SELECT,
          raw: true,
          replacements,
        }
      );

    return this.userModel.findAll({
      attributes: [...UserAttributes],
      where: {
        id: candidatesIds.map(({ userId }) => userId),
      },
      order: [['firstName', 'ASC']],
      include: [
        {
          model: Organization,
          as: 'organization',
          attributes: ['name', 'address', 'zone', 'id'],
          required: false,
        },
        {
          model: UserProfile,
          as: 'userProfile',
          attributes: ['id', 'hasPicture'],
          required: false,
        },
      ],
    });
  }

  async findAllCoachMembers(
    params: {
      limit: number;
      offset: number;
      search: string;
    } & FilterParams<MemberFilterKey>
  ): Promise<User[]> {
    const { limit, offset, search, ...restParams } = params;

    const allBusinessSectors = await this.businessSectorsService.all();
    const { replacements, filterOptions } = getCommonMembersFilterOptions(
      {
        ...restParams,
        role: [UserRoles.COACH],
      },
      allBusinessSectors
    );

    const coachesIds: { userId: string }[] =
      await this.userModel.sequelize.query(
        `
        SELECT 
          "User"."id" as "userId"

        FROM "Users" as "User"

        LEFT OUTER JOIN "Organizations" AS "organization" 
          ON "User"."OrganizationId" = "organization"."id"
            
        WHERE "User"."deletedAt" IS NULL
          AND ${filterOptions.join(' AND ')} ${
          search ? `AND ${userSearchQueryRaw(search, true)}` : ''
        }
        
        GROUP BY "User"."id"
        ORDER BY "User"."firstName" ASC
        LIMIT ${limit}
        OFFSET ${offset}
        `,
        {
          type: QueryTypes.SELECT,
          raw: true,
          replacements,
        }
      );

    return this.userModel.findAll({
      attributes: [...UserAttributes],
      where: {
        id: coachesIds.map(({ userId }) => userId),
      },
      order: [['firstName', 'ASC']],
      include: [
        {
          model: Organization,
          as: 'organization',
          attributes: ['name', 'address', 'zone', 'id'],
          required: false,
        },
        {
          model: UserProfile,
          as: 'userProfile',
          attributes: ['id', 'hasPicture'],
          required: false,
        },
      ],
    });
  }

  async findAllRefererMembers(
    params: {
      limit: number;
      offset: number;
      search: string;
    } & FilterParams<MemberFilterKey>
  ): Promise<User[]> {
    const { limit, offset, search, ...restParams } = params;

    const allBusinessSectors = await this.businessSectorsService.all();
    const { replacements, filterOptions } = getCommonMembersFilterOptions(
      {
        ...restParams,
        role: [UserRoles.REFERER],
      },
      allBusinessSectors
    );

    const referersIds: { userId: string }[] =
      await this.userModel.sequelize.query(
        `
        SELECT 
          "User"."id" as "userId"

        FROM "Users" as "User"
                     
        LEFT OUTER JOIN "Organizations" AS "organization" 
          ON "User"."OrganizationId" = "organization"."id"
            
        WHERE "User"."deletedAt" IS NULL
          AND ${filterOptions.join(' AND ')} ${
          search ? `AND ${userSearchQueryRaw(search, true)}` : ''
        }
        
        GROUP BY "User"."id"
        ORDER BY "User"."firstName" ASC
        LIMIT ${limit}
        OFFSET ${offset}
        `,
        {
          type: QueryTypes.SELECT,
          raw: true,
          replacements,
        }
      );

    return this.userModel.findAll({
      attributes: [...UserAttributes],
      where: {
        id: referersIds.map(({ userId }) => userId),
      },
      order: [['firstName', 'ASC']],
      include: [
        {
          model: User,
          as: 'referredCandidates',
          attributes: [...UserAttributes],
        },
        {
          model: Organization,
          as: 'organization',
          attributes: ['name', 'address', 'zone', 'id'],
          required: false,
        },
        {
          model: UserProfile,
          as: 'userProfile',
          attributes: ['id', 'hasPicture'],
          required: false,
        },
      ],
    });
  }

  async countOrganizationAssociatedUsers(organizationId: string) {
    const { count: candidatesCount } = await this.userModel.findAndCountAll({
      where: {
        OrganizationId: organizationId,
        role: UserRoles.CANDIDATE,
      },
    });

    const { count: referersCount } = await this.userModel.findAndCountAll({
      where: {
        OrganizationId: organizationId,
        role: UserRoles.REFERER,
      },
    });

    return {
      candidatesCount,
      referersCount,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const shouldCheckOnboardingTransition =
      updateUserDto.onboardingStatus !== undefined;

    const previousUser = shouldCheckOnboardingTransition
      ? await this.findOne(id)
      : null;

    await this.userModel.update(updateUserDto, {
      where: { id },
      individualHooks: true,
      hooks: true,
      returning: true,
    });

    const updatedUser = await this.findOneWithRelations(id);

    if (!updatedUser) {
      return null;
    }

    if (
      updateUserDto.onboardingStatus === OnboardingStatus.COMPLETED &&
      previousUser?.onboardingStatus !== OnboardingStatus.COMPLETED
    ) {
      await this.queuesService.addToWorkQueue(Jobs.ON_ONBOARDING_COMPLETED, {
        userId: updatedUser.id,
      });
    }

    return updatedUser;
  }

  async sendOnboardingCompletedMail(
    user: User,
    recommendations: RecommendationDto[]
  ) {
    return this.mailsService.sendOnboardingCompletedMail(user, recommendations);
  }

  async sendMailForNoResponseToFirstMessage(
    dto: NoResponseToFirstMessageResultDto
  ) {
    return this.mailsService.sendMailForNoResponseToFirstMessage(
      dto.user,
      dto.addressees.map((addressee) => addressee.firstName).join(', '),
      dto.recommendations
    );
  }

  async remove(id: string) {
    return this.userModel.destroy({
      where: { id },
      individualHooks: true,
    });
  }

  // Get all users -except admins- that have connected once but not in the last 25 months and not deleted
  async getInactiveUsersForDeletion() {
    const inactiveUsers: {
      id: string;
      firstName: string;
      lastName: string;
      candidatUrl: string | null;
    }[] = await this.userModel.sequelize.query(
      `
        SELECT
            "Users"."id" as id,
            "Users"."firstName" as "firstName",
            "Users"."lastName" as "lastName",
            "Users"."lastConnection" as "lastConnection",
            "Users"."createdAt" as "createdAt"
        FROM
            "Users"
        WHERE
            (
                ( -- has already signed in --
                    "Users"."lastConnection" IS NOT NULL
                    -- isInactiveSince --
                    AND "Users"."lastConnection" < CURRENT_TIMESTAMP - INTERVAL '25 MONTH'
                )
                OR ( -- has never signed in --
                    "Users"."lastConnection" IS NULL
                    -- createdAt is old enough --
                    AND "Users"."createdAt" < CURRENT_TIMESTAMP - INTERVAL '25 MONTH'
                )
            )
            -- is not deleted --
            AND "Users"."deletedAt" IS NULL
            -- Filter on role --
            AND "Users".role NOT IN ('Admin')
        ORDER BY
            "Users"."lastConnection" ASC,
            "Users"."createdAt" ASC;
      `,
      {
        type: QueryTypes.SELECT,
        raw: true,
      }
    );
    const users = inactiveUsers.map((user) => {
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    });
    return users;
  }

  async generateVerificationToken(user: User) {
    return this.authService.generateVerificationToken(user);
  }

  async sendVerificationMail(user: User, token: string) {
    return this.mailsService.sendVerificationMail(user, token);
  }

  async findAllPublicCVs(query: { limit: number; offset: number }) {
    const { limit, offset } = query;

    return this.userModel.findAll({
      limit,
      offset,
      attributes: PublicUserAttributes,
      include: UserIncludes(),
      order: getUserProfileRecentlyUpdatedOrder(),
      where: {
        lastConnection: { [Op.ne]: null },
        role: UserRoles.CANDIDATE,
      },
    });
  }

  /**
   * Get candidates and coaches that have not completed their onboarding
   * @param daysSinceCreation
   * @returns Array of users that have not completed their onboarding
   */
  async getUsersNotCompletedOnboarding(daysSinceCreation: number) {
    const users = await this.userModel.findAll({
      attributes: [
        'id',
        'email',
        'firstName',
        'lastName',
        'onboardingStatus',
        'createdAt',
        'zone',
        'role',
      ],
      where: {
        role: {
          [Op.in]: [UserRoles.CANDIDATE, UserRoles.COACH],
        },
        createdAt: {
          [Op.gte]: new Date(
            new Date().setHours(0, 0, 0, 0) -
              daysSinceCreation * 24 * 60 * 60 * 1000
          ),
          [Op.lt]: new Date(
            new Date().setHours(0, 0, 0, 0) -
              (daysSinceCreation - 1) * 24 * 60 * 60 * 1000
          ),
        },
        onboardingStatus: {
          [Op.ne]: OnboardingStatus.COMPLETED,
        },
      },
    });

    return users;
  }

  async sendReminderToCompleteOnboarding(user: User) {
    return this.mailsService.sendReminderToCompleteOnboarding(user);
  }

  async sendOnboardingBAOMailToUser(user: User) {
    return this.mailsService.sendOnboardingBAOMail(user);
  }

  async sendOnboardingContactAdviceMail(user: User) {
    return this.mailsService.sendOnboardingContactAdviceMail(user);
  }

  async getUsersCompletedOnboardingSinceDelay(
    daysSinceOnboardingCompletion: number
  ) {
    const users = await this.userModel.findAll({
      attributes: [...UserAttributes],
      where: {
        role: {
          [Op.in]: [UserRoles.CANDIDATE, UserRoles.COACH],
        },
        onboardingCompletedAt: {
          [Op.gte]: new Date(
            new Date().setHours(0, 0, 0, 0) -
              daysSinceOnboardingCompletion * 24 * 60 * 60 * 1000
          ),
          [Op.lt]: new Date(
            new Date().setHours(0, 0, 0, 0) -
              (daysSinceOnboardingCompletion - 1) * 24 * 60 * 60 * 1000
          ),
        },
        onboardingStatus: OnboardingStatus.COMPLETED,
      },
    });

    return users;
  }

  async getUsersWithNotCompletedProfile(daysAfterOnboardingCompletion: number) {
    const endDate = new Date(
      new Date().setHours(0, 0, 0, 0) -
        (daysAfterOnboardingCompletion - 1) * 24 * 60 * 60 * 1000
    );
    const startDate = new Date(
      new Date().setHours(0, 0, 0, 0) -
        daysAfterOnboardingCompletion * 24 * 60 * 60 * 1000
    );

    const rawMatchingUsers: { id: string }[] =
      await this.userModel.sequelize.query(
        `
        SELECT DISTINCT
          "User"."id" as id

        FROM "Users" as "User"
        LEFT OUTER JOIN "UserProfiles" as "userProfile"
          ON "User"."id" = "userProfile"."userId"

        WHERE "User"."deletedAt" IS NULL
          AND "User"."onboardingStatus" = :onboardingStatus
          AND "User"."onboardingCompletedAt" >= :startDate
          AND "User"."onboardingCompletedAt" < :endDate
          AND "User"."role" IN (:candidateRole, :coachRole)
          AND (
            "userProfile"."description" IS NULL
            OR "userProfile"."hasPicture" = FALSE
            OR NOT EXISTS (
              SELECT 1
              FROM "UserProfileSectorOccupations" as upso
              WHERE upso."userProfileId" = "userProfile"."id"
                AND upso."businessSectorId" IS NOT NULL
                AND upso."occupationId" IS NOT NULL
            )
          );
        `,
        {
          type: QueryTypes.SELECT,
          raw: true,
          replacements: {
            onboardingStatus: OnboardingStatus.COMPLETED,
            startDate,
            endDate,
            candidateRole: UserRoles.CANDIDATE,
            coachRole: UserRoles.COACH,
          },
        }
      );

    const userIds = rawMatchingUsers.map((user) => user.id);

    if (userIds.length === 0) {
      return [];
    }

    return this.userModel.findAll({
      attributes: [...UserAttributes],
      include: [
        {
          model: UserProfile,
          as: 'userProfile',
          attributes: userProfileAttributes,
          required: false,
        },
      ],
      where: {
        id: userIds,
      },
    });
  }

  async getUsersWithNoResponseToFirstMessage(
    daysSinceFirstMessage: number,
    roles: UserRole[] = [UserRoles.CANDIDATE, UserRoles.COACH]
  ): Promise<NoResponseToFirstMessageResultDto[]> {
    const startDate = new Date(
      new Date().setHours(0, 0, 0, 0) - daysSinceFirstMessage * DAY_IN_MS
    );
    const endDate = new Date(
      new Date().setHours(0, 0, 0, 0) - (daysSinceFirstMessage - 1) * DAY_IN_MS
    );

    const rows: {
      authorId: string;
      addresseeId: string;
      messageId: string;
    }[] = await this.userModel.sequelize.query(
      `
      SELECT
        m."authorId" as "authorId",
        cp."userId" as "addresseeId",
        m."id" as "messageId"
      FROM "Messages" m
      INNER JOIN (
        SELECT "conversationId"
        FROM "Messages"
        GROUP BY "conversationId"
        HAVING COUNT(*) = 1
      ) AS single_message_conversations
        ON single_message_conversations."conversationId" = m."conversationId"
      INNER JOIN "Users" author
        ON author."id" = m."authorId"
      INNER JOIN "ConversationParticipants" cp
        ON cp."conversationId" = m."conversationId"
      WHERE m."createdAt" >= :startDate
        AND m."createdAt" < :endDate
        AND author."deletedAt" IS NULL
        AND author."role" IN (:roles)
        AND cp."userId" <> m."authorId"
      `,
      {
        type: QueryTypes.SELECT,
        raw: true,
        replacements: {
          startDate,
          endDate,
          roles,
        },
      }
    );

    if (rows.length === 0) {
      return [];
    }

    // Create a structure to link authors to their addressees (one by message)
    const messageMap = new Map<
      string,
      { authorId: string; addresseeIds: string[] }
    >();
    rows.forEach(({ authorId, addresseeId, messageId }) => {
      if (!messageMap.has(messageId)) {
        messageMap.set(messageId, { authorId, addresseeIds: [addresseeId] });
      } else {
        messageMap.get(messageId).addresseeIds.push(addresseeId);
      }
    });

    const items = Array.from(messageMap.entries());
    const results = await Promise.all(
      items.map(async ([, { authorId, addresseeIds }]) => {
        const [author, authorProfile, addressees] = await Promise.all([
          this.findOneWithRelations(authorId),
          this.userProfilesService.findOneByUserId(authorId),
          this.findByIdsWithRelations(addresseeIds),
        ]);
        if (!author || !authorProfile || addressees.length === 0) {
          return null;
        }
        const recommendations =
          await this.userProfileRecommendationsService.retrieveOrComputeRecommendationsForUserIdIA(
            author,
            authorProfile,
            3
          );
        return {
          id: authorId,
          user: author,
          addressees,
          recommendations: recommendations,
        };
      })
    );

    return results.filter(
      (result): result is NoResponseToFirstMessageResultDto => result !== null
    );
  }

  async sendReminderToCompleteProfile(user: User) {
    return this.mailsService.sendReminderToCompleteProfile(user);
  }

  async sendFollowUpMailForMutuallyRepliedConversation(
    user: User,
    conversation: Conversation
  ) {
    return this.mailsService.sendFollowUpMailForMutuallyRepliedConversation(
      user,
      conversation
    );
  }

  /**
   * Returns all non-deleted users who have connected to the platform
   * within the last `months` months, excluding Admins.
   *
   * Used for backfilling achievement eligibility on deployment.
   *
   * @param months - Lookback window in months
   */
  async findActiveCoachesInLastMonths(
    months: number
  ): Promise<Pick<User, 'id'>[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    return this.userModel.findAll({
      attributes: ['id'],
      where: {
        role: { [Op.in]: [UserRoles.COACH] },
        lastConnection: { [Op.gte]: since },
      },
    });
  }

  async getUsersInactiveForRecommendationMails(
    daysSinceLastConnection: number
  ): Promise<Pick<User, 'id' | 'firstName' | 'email' | 'role' | 'zone'>[]> {
    const startDate = new Date(
      new Date().setHours(0, 0, 0, 0) - daysSinceLastConnection * DAY_IN_MS
    );
    const endDate = new Date(
      new Date().setHours(0, 0, 0, 0) -
        (daysSinceLastConnection - 1) * DAY_IN_MS
    );

    return this.userModel.sequelize.query(
      `
      SELECT DISTINCT
        u."id"
      FROM "Users" u
      JOIN "UserProfiles" up ON u.id = up."userId"
      WHERE
        up."isAvailable" IS TRUE
        AND u."lastConnection" >= :startDate
        AND u."lastConnection" < :endDate
        AND u."onboardingStatus" = :onboardingStatus
        AND u.role IN (:candidateRole, :coachRole)
        AND u."deletedAt" IS NULL
      `,
      {
        type: QueryTypes.SELECT,
        raw: true,
        replacements: {
          startDate,
          endDate,
          onboardingStatus: OnboardingStatus.COMPLETED,
          candidateRole: UserRoles.CANDIDATE,
          coachRole: UserRoles.COACH,
        },
      }
    );
  }

  async sendRecommendationsMail(
    user: User,
    recommendationsDto: RecommendationsDto
  ) {
    return this.mailsService.sendRecommendationsMail(user, recommendationsDto);
  }

  async generatePostOnboardingWelcomeMessage(user: User) {
    const isCompanyAdmin = user.company?.companyUser?.isAdmin;
    if (user.role === UserRoles.CANDIDATE) {
      return [
        `Bonjour ${user.firstName},`,
        '',
        `Bienvenue sur Entourage Pro, je suis ${user.staffContact.name}, votre point de contact sur la plateforme.`,
        '',
        'Je suis là pour vous accompagner si vous avez la moindre question : contacter un coach, préparer un premier échange ou savoir comment bénéficier au mieux du réseau Entourage Pro.',
        '',
        '👉 Vous pouvez dès maintenant parcourir les profils de coachs et envoyer un premier message. Quelques lignes suffisent pour démarrer la conversation.',
        '',
        'Les mises en relation sont simples, bienveillantes et sans engagement.',
        '',
        'À très bientôt,',
        `${user.staffContact.name}`,
      ].join('\n');
    } else if (user.role === UserRoles.COACH && !isCompanyAdmin) {
      return [
        `Bonjour ${user.firstName},`,
        '',
        'Je vous souhaite la bienvenue en tant que coach sur Entourage Pro.',
        '',
        `Je suis ${user.staffContact.name}, votre point de contact sur la plateforme.`,
        '',
        'Je suis disponible si vous avez besoin d’aide pour démarrer, comprendre le fonctionnement ou optimiser votre profil.',
        '',
        '👉 Vous pouvez dès maintenant consulter les profils des candidats et initier un premier contact si un parcours vous interpelle. Un message simple et personnalisé suffit à lancer l’échange.',
        '',
        'Merci pour votre engagement au service du réseau.',
        '',
        'Je reste à votre disposition,',
        '',
        `${user.staffContact.name}`,
      ].join('\n');
    }
    return null;
  }

  getUserMirrorRole = (role: UserRole): UserRole | null => {
    switch (role) {
      case UserRoles.CANDIDATE:
        return UserRoles.COACH;
      case UserRoles.COACH:
      case UserRoles.REFERER:
        return UserRoles.CANDIDATE;
      default:
        return null;
    }
  };
}
