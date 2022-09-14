import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bull';
import * as _ from 'lodash';
import { ContactStatus, ContactStatuses } from '../mails/mails.types';
import { getRelatedUser } from '../users/users.utils';
import { BusinessLine } from 'src/businessLines/models';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { Department } from 'src/locations/locations.types';
import { MailchimpService } from 'src/mails/mailchimp.service';
import { MailsService } from 'src/mails/mails.service';
import { Jobs, Queues } from 'src/queues/queues.types';
import { SMSService } from 'src/sms/sms.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { getZoneFromDepartment } from 'src/utils/misc';
import { AdminZone } from 'src/utils/types';
import { CreateExternalOpportunityRestrictedDto } from './dto/create-external-opportunity-restricted.dto';
import { CreateExternalOpportunityDto } from './dto/create-external-opportunity.dto';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { Opportunity, OpportunityUser } from './models';
import { OpportunityCandidateAttributes } from './models/opportunity.attributes';
import { OpportunityCompleteInclude } from './models/opportunity.include';
import { OpportunityUsersService } from './opportunity-users.service';

@Injectable()
export class OpportunitiesService {
  constructor(
    @InjectModel(Opportunity)
    private opportunityModel: typeof Opportunity,
    @InjectModel(OpportunityUser)
    private opportunityUserModel: typeof Opportunity,
    @InjectModel(BusinessLine)
    private businessLineModel: typeof BusinessLine,
    @InjectQueue(Queues.WORK)
    private workQueue: Queue,
    private mailchimpService: MailchimpService,
    private opportunityUsersService: OpportunityUsersService,
    private usersService: UsersService,
    private externalDatabasesService: ExternalDatabasesService,
    private mailsService: MailsService,
    private smsService: SMSService
  ) {}

  async create(
    createOpportunityDto: Partial<
      Omit<
        CreateOpportunityDto,
        | 'isAdmin'
        | 'locations'
        | 'shouldSendNotifications'
        | 'isCopy'
        | 'candidatesId'
      >
    >,
    candidateIds?: string[],
    isAdmin = false,
    createdById?: string
  ) {
    const createdOpportunity = await this.opportunityModel.create({
      ...createOpportunityDto,
      isValidated: !!isAdmin,
      createdBy: createdById,
    });

    if (createOpportunityDto.businessLines) {
      const businessLines = await Promise.all(
        createOpportunityDto.businessLines.map(({ name, order = -1 }) => {
          return this.businessLineModel.create({ name, order });
        })
      );
      await createdOpportunity.$add('businessLines', businessLines);
    }
    return createdOpportunity;
  }

  async createExternal(
    createExternalOpportunityDto: Partial<
      Omit<
        CreateExternalOpportunityDto | CreateExternalOpportunityRestrictedDto,
        'candidateId'
      >
    >,
    candidateId: string,
    createdById: string
  ) {
    const createdOpportunity = await this.opportunityModel.create({
      ...createExternalOpportunityDto,
      isExternal: true,
      isPublic: false,
      isArchived: false,
      isValidated: true,
      createdBy: createdById,
    });

    await this.opportunityUsersService.create({
      OpportunityId: createdOpportunity.id,
      UserId: candidateId,
      status:
        createExternalOpportunityDto.status &&
        createExternalOpportunityDto.status > -1
          ? createExternalOpportunityDto.status
          : 0,
    });

    if (
      createExternalOpportunityDto instanceof CreateExternalOpportunityDto &&
      createExternalOpportunityDto.businessLines
    ) {
      const businessLines = await Promise.all(
        createExternalOpportunityDto.businessLines.map(
          ({ name, order = -1 }) => {
            return this.businessLineModel.create({ name, order });
          }
        )
      );
      await createdOpportunity.$add('businessLines', businessLines);
    }

    return this.findOneAsCandidate(createdOpportunity.id, candidateId);
  }

  async findAllCandidateIdsToRecommendOfferTo(
    department: Department,
    businessLines: BusinessLine[]
  ) {
    if (department && businessLines?.length > 0) {
      const autoRecommendationsZone = process.env.AUTO_RECOMMENDATIONS_ZONE;
      if (
        !autoRecommendationsZone ||
        autoRecommendationsZone === getZoneFromDepartment(department)
      ) {
        const publishedCandidates =
          await this.usersService.findAllPublishedCandidatesByDepartmentAndBusinessLines(
            department,
            businessLines
          );

        return publishedCandidates.map(({ id }) => {
          return id;
        });
      }
    }
    return [] as string[];
  }

  findAll() {
    return `This action returns all opportunities`;
  }

  async findOne(id: string) {
    return this.opportunityModel.findByPk(id, {
      include: OpportunityCompleteInclude,
    });
  }

  async findOneAsCandidate(id: string, candidateId: string) {
    const opportunityUser =
      await this.opportunityUsersService.findOneByCandidateIdAndOpportunityId(
        candidateId,
        id
      );

    if (!opportunityUser) {
      return null;
    }

    const opportunity = await this.opportunityModel.findOne({
      where: { isValidated: true, isArchived: false, id },
      attributes: [...OpportunityCandidateAttributes],
      include: OpportunityCompleteInclude,
    });

    if (!opportunity) {
      return null;
    }

    return {
      ...opportunity.toJSON(),
      opportunityUser: opportunityUser.toJSON(),
    };
  }

  async countExternalOpportunitiesCreatedByUser(userId: string) {
    const { count } = await this.opportunityModel.findAndCountAll({
      where: {
        createdBy: userId,
        isExternal: true,
      },
    });
    return count;
  }

  async associateUsersToOpportunity(
    opportunity: Opportunity,
    candidatesId: string[]
  ) {
    const candidateIdsToRecommendTo = opportunity.isPublic
      ? await this.findAllCandidateIdsToRecommendOfferTo(
          opportunity.department,
          opportunity.businessLines
        )
      : [];

    if (candidatesId?.length > 0 || candidateIdsToRecommendTo?.length > 0) {
      const uniqueCandidateIds = _.uniq([
        ...(candidatesId || []),
        ...(candidateIdsToRecommendTo || []),
      ]);

      await Promise.all(
        uniqueCandidateIds.map((candidateId) => {
          return this.opportunityUsersService.create({
            OpportunityId: opportunity.id,
            UserId: candidateId,
            recommended: opportunity.isPublic,
          });
        })
      );

      return this.opportunityUsersService.findAllByCandidateIdsAndOpportunityId(
        uniqueCandidateIds,
        opportunity.id
      );
    }
    return null;
  }

  async sendRecruitorMailToMailchimp(
    mail: string,
    zone: AdminZone | AdminZone[],
    contactStatus: ContactStatus
  ) {
    return this.mailchimpService.sendContact(mail, zone, contactStatus);
  }

  async sendMailsAfterCreation(
    opportunity: Opportunity,
    candidates: OpportunityUser[],
    isAdmin = false,
    shouldSendNotifications = true
  ) {
    if (candidates && candidates.length > 0) {
      if (!isAdmin) {
        await this.mailsService.sendOnCreatedOfferMail(opportunity);
      } else {
        await this.sendOnValidatedOfferMail(opportunity);

        if (shouldSendNotifications) {
          await this.sendCandidateOfferMessages(candidates, opportunity);
        }
      }
    }

    await this.sendRecruitorMailToMailchimp(
      opportunity.contactMail || opportunity.recruiterMail,
      getZoneFromDepartment(opportunity.department),
      ContactStatuses.COMPANY
    );
  }

  async sendMailAfterExternalCreation(
    opportunity: Opportunity,
    isAdmin = false
  ) {
    if (!isAdmin) {
      return this.mailsService.sendOnCreatedExternalOfferMail(opportunity);
    }
  }

  async sendOnValidatedOfferMail(opportunity: Opportunity) {
    await this.mailsService.sendOnValidatedOfferMail(opportunity);

    await this.workQueue.add(
      Jobs.NO_RESPONSE_OFFER,
      {
        opportunityId: opportunity.id,
      },
      {
        delay:
          (process.env.OFFER_NO_RESPONSE_DELAY
            ? parseFloat(process.env.OFFER_NO_RESPONSE_DELAY)
            : 15) *
          3600000 *
          24,
      }
    );
  }

  async sendCandidateOfferMessages(
    opportunityUsers: OpportunityUser[],
    opportunity: Opportunity
  ) {
    return Promise.all(
      opportunityUsers.map(async (opportunityUser) => {
        await this.mailsService.sendCandidateOfferMail(
          opportunityUser,
          opportunity
        );

        const candidatPhone = opportunityUser?.user?.phone;

        await this.smsService.sendCandidateOfferSMS(
          candidatPhone,
          opportunity.id
        );

        if (!opportunity.isPublic) {
          await this.workQueue.add(
            Jobs.REMINDER_OFFER,
            {
              opportunityId: opportunity.id,
              candidateId: opportunityUser.user.id,
            },
            {
              delay:
                (process.env.OFFER_REMINDER_DELAY
                  ? parseFloat(process.env.OFFER_REMINDER_DELAY)
                  : 5) *
                3600000 *
                24,
            }
          );
        }
      })
    );
  }

  async sendNoResponseOffer(opportunityId: string) {
    const opportunity = await this.findOne(opportunityId);
    return this.mailsService.sendNoResponseOfferMail(opportunity);
  }

  async sendReminderAboutOffer(opportunityId: string, candidateId: string) {
    const opportunity = await this.findOneAsCandidate(
      opportunityId,
      candidateId
    );

    const candidate: User = opportunity.opportunityUser.user;

    const candidatPhone = candidate?.phone;

    await this.smsService.sendReminderAboutOfferSMS(
      candidatPhone,
      opportunity.id
    );

    return this.mailsService.sendReminderOfferMail(opportunity);
  }

  async sendReminderAboutExternalOffers(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    let opportunitiesCreatedByCandidateOrCoach =
      await this.countExternalOpportunitiesCreatedByUser(candidateId);

    const coach = getRelatedUser(candidate);
    if (coach) {
      opportunitiesCreatedByCandidateOrCoach +=
        await this.countExternalOpportunitiesCreatedByUser(coach.id);
    }

    if (opportunitiesCreatedByCandidateOrCoach === 0) {
      return this.mailsService.sendExternalOffersReminderMails(candidate);
    }
  }

  async createExternalDBOpportunity(createdOpportunityId: string | string[]) {
    return this.externalDatabasesService.createExternalDBOpportunity(
      createdOpportunityId
    );
  }

  async updateExternalDBOpportunity(updatedOpportunityId: string | string[]) {
    return this.externalDatabasesService.updateExternalDBOpportunity(
      updatedOpportunityId
    );
  }
}
