import { ConflictException, Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { CompaniesService } from 'src/companies/companies.service';
import { CompanyInvitationsService } from 'src/companies/company-invitations.service';
import { CompanyUsersService } from 'src/companies/company-user.service';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { CustomContactParams } from 'src/external-services/mailjet/mailjet.types';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UserSocialSituationsService } from 'src/user-social-situations/user-social-situations.service';
import { User, UserCandidat, UserSocialSituation } from 'src/users/models';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
import { Utm } from 'src/utm/models';
import { UtmService } from 'src/utm/utm.service';
import { CreateUserRegistrationDto } from './dto';

@Injectable()
export class UsersCreationService {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private userProfilesService: UserProfilesService,
    private userCandidatsService: UserCandidatsService,
    private mailsService: MailsService,
    private externalDatabasesService: ExternalDatabasesService,
    private userSocialSituationService: UserSocialSituationsService,
    private queuesService: QueuesService,
    private utmService: UtmService,
    private companiesService: CompaniesService,
    private companyUsersService: CompanyUsersService,
    private companyInvitationsService: CompanyInvitationsService
  ) {}

  async createUser(createUserDto: Partial<User>) {
    return this.usersService.create(createUserDto);
  }

  async createExternalDBUser(
    createdUserId: string,
    otherInfo: Pick<
      CreateUserRegistrationDto,
      | 'workingRight'
      | 'campaign'
      | 'birthDate'
      | 'workingRight'
      | 'gender'
      | 'structure'
      | 'refererEmail'
    >
  ) {
    return this.externalDatabasesService.createExternalDBUser(
      createdUserId,
      otherInfo
    );
  }

  async findOneUser(id: string) {
    return this.usersService.findOne(id);
  }

  async findOneUserCandidatByCandidateId(candidateId: string) {
    return this.userCandidatsService.findOneByCandidateId(candidateId);
  }

  async loginUser(user: User) {
    return this.authService.login(user);
  }

  generateRandomPasswordInJWT(expiration: string | number = '1d') {
    return this.authService.generateRandomPasswordInJWT(expiration);
  }

  async sendNewAccountMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    return this.mailsService.sendNewAccountMail(user, token);
  }

  async sendVerificationMail(user: User) {
    const token = await this.authService.generateVerificationToken(user);
    return this.mailsService.sendVerificationMail(user, token);
  }

  async sendFinalizeAccountReferedUser(candidate: User, referer: User) {
    const token = await this.authService.generateVerificationToken(candidate);
    return this.mailsService.sendReferedCandidateFinalizeAccountMail(
      referer,
      candidate,
      token
    );
  }

  async sendOnboardingJ1BAOMail(user: User) {
    return this.mailsService.sendOnboardingJ1BAOMail(user);
  }

  async sendOnboardingJ3WebinarMail(user: User) {
    return this.mailsService.sendOnboardingJ3WebinarMail(user);
  }

  async sendOnboardingJ4ContactAdviceMail(user: User) {
    return this.mailsService.sendOnboardingJ4ContactAdviceMail(user);
  }

  async sendAdminNewRefererNotificationMail(referer: User) {
    return this.mailsService.sendAdminNewRefererNotificationMail(referer);
  }

  async updateUserCandidatByCandidateId(
    candidateId: string,
    updateUserCandidatDto: Partial<UserCandidat>
  ) {
    return this.userCandidatsService.updateByCandidateId(
      candidateId,
      updateUserCandidatDto
    );
  }

  async updateAllUserCandidatLinkedUserByCandidateId(
    candidatesAndCoachesIds: { candidateId: string; coachId: string }[]
  ): Promise<UserCandidat[]> {
    return this.userCandidatsService.updateAllLinkedCoachesByCandidatesIds(
      candidatesAndCoachesIds
    );
  }

  async updateUserProfileByUserId(
    userId: string,
    updateUserProfileDto: Partial<UserProfile> & {
      nudgeIds?: string[];
    }
  ) {
    return this.userProfilesService.updateByUserId(
      userId,
      updateUserProfileDto
    );
  }

  async updateUserSocialSituationByUserId(
    userId: string,
    updateUserSocialSituationDto: Partial<UserSocialSituation>
  ) {
    return this.userSocialSituationService.createOrUpdateSocialSituation(
      userId,
      {
        networkInsecurity: updateUserSocialSituationDto.networkInsecurity,
        materialInsecurity: updateUserSocialSituationDto.materialInsecurity,
      }
    );
  }

  async sendContactToMailjet(contact: CustomContactParams) {
    await this.queuesService.addToWorkQueue(
      Jobs.NEWSLETTER_SUBSCRIPTION,
      contact
    );
  }

  async createUtm(createUtmDto: Partial<Utm>) {
    return this.utmService.create(createUtmDto);
  }

  async findOneCompany(companyId: string) {
    return this.companiesService.findOne(companyId);
  }

  async linkUserToCompany(
    userId: string,
    companyId: string,
    role: string,
    isAdmin = false
  ): Promise<void> {
    const companyUser = await this.companyUsersService.findOneCompanyUser(
      companyId,
      userId
    );

    if (!companyUser) {
      await this.companyUsersService.createCompanyUser({
        userId,
        companyId,
        role,
        isAdmin,
      });
    }
  }

  async findOneCompanyUser(companyId: string) {
    return this.companyUsersService.findOneCompanyUser(companyId);
  }

  async linkInvitationToUser(
    userId: string,
    invitationId: string
  ): Promise<void> {
    const invitation = await this.companyInvitationsService.findOneById(
      invitationId
    );
    if (!invitation) {
      throw new Error(`Invitation with ID ${invitationId} not found`);
    }
    if (invitation.userId) {
      throw new ConflictException(
        `Invitation with ID ${invitationId} is already linked to a user`
      );
    }
    await this.companyInvitationsService.update(invitationId, {
      userId,
    });
  }
}
