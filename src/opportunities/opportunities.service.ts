import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bull';
import * as _ from 'lodash';
import {
  ContactStatus,
  ContactStatuses,
  CustomMailParams,
} from '../mails/mails.types';
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
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { Opportunity, OpportunityUser } from './models';
import { OpportunityCompleteInclude } from './models/opportunity.include';
import { OpportunityUsersService } from './opportunity-users.service';
import { getRelatedUser } from '../users/users.utils';

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
    createOpportunityDto: Partial<Opportunity>,
    candidatesId?: string[],
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
    });

    if (!opportunity) {
      return null;
    }

    return {
      ...opportunity.toJSON(),
      opportunityUser: opportunityUser.toJSON(),
    };
  }

  update(id: number, updateOpportunityDto: UpdateOpportunityDto) {
    return `This action updates a #${id} opportunity`;
  }

  remove(id: number) {
    return `This action removes a #${id} opportunity`;
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

  async sendRecruitorMailToMailchimp(
    mail: string,
    zone: AdminZone | AdminZone[],
    contactStatus: ContactStatus
  ) {
    return this.mailchimpService.sendContact(mail, zone, contactStatus);
  }

  async sendMailsAfterCreation(
    opportunity: Opportunity,
    candidatesId: string[],
    isAdmin = false,
    shouldSendNotifications = true
  ) {
    let candidates: OpportunityUser[] = [];

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

      candidates =
        await this.opportunityUsersService.findAllByCandidateIdsAndOpportunityId(
          uniqueCandidateIds,
          opportunity.id
        );

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
