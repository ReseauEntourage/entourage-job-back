import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as _ from 'lodash';
import moment from 'moment';
import { Op } from 'sequelize';
import { BusinessLineValue } from 'src/common/business-lines/business-lines.types';
import { BusinessLine } from 'src/common/business-lines/models';
import {
  Department,
  DepartmentFilters,
} from 'src/common/locations/locations.types';
import { Location } from 'src/common/locations/models';
import { CVsService } from 'src/cvs/cvs.service';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { ContactStatuses } from 'src/external-services/mailjet/mailjet.types';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { SMSService } from 'src/sms/sms.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { CandidateUserRoles } from 'src/users/users.types';
import { getCoachFromCandidate, isRoleIncluded } from 'src/users/users.utils';
import { getZoneFromDepartment } from 'src/utils/misc';
import { AdminZone, FilterParams } from 'src/utils/types';
import {
  CreateExternalOpportunityDto,
  CreateOpportunityDto,
  UpdateExternalOpportunityDto,
  UpdateOpportunityDto,
} from './dto';
import {
  Opportunity,
  OpportunityBusinessLine,
  OpportunityUser,
  OpportunityUserStatusChange,
} from './models';
import { OpportunityCandidateAttributes } from './models/opportunity.attributes';
import {
  OpportunityCompleteAdminWithoutBusinessLinesInclude,
  OpportunityCompleteInclude,
  OpportunityCompleteWithoutOpportunityUsersInclude,
} from './models/opportunity.include';
import {
  OfferAdminTab,
  OfferAdminTabs,
  OfferCandidateTab,
  OfferFilterKey,
  OfferStatuses,
  OpportunityRestricted,
} from './opportunities.types';
import {
  destructureOptionsAndParams,
  filterAdminOffersByType,
  filterOffersByStatus,
  getOfferOptions,
  renderOffersQuery,
  sortOpportunities,
} from './opportunities.utils';
import { OpportunityUsersService } from './opportunity-users.service';
import { ContractValue } from 'src/common/contracts/contracts.types';

const LIMIT = 25;

@Injectable()
export class OpportunitiesService {
  constructor(
    @InjectModel(Opportunity)
    private opportunityModel: typeof Opportunity,
    @InjectModel(OpportunityUser)
    private opportunityUserModel: typeof OpportunityUser,
    @InjectModel(BusinessLine)
    private businessLineModel: typeof BusinessLine,
    @InjectModel(OpportunityBusinessLine)
    private opportunityBusinessLineModel: typeof OpportunityBusinessLine,
    @InjectModel(OpportunityUserStatusChange)
    private opportunityUserStatusChangeModel: typeof OpportunityUserStatusChange,
    private queuesService: QueuesService,
    private opportunityUsersService: OpportunityUsersService,
    private usersService: UsersService,
    private cvsService: CVsService,
    private externalDatabasesService: ExternalDatabasesService,
    private mailsService: MailsService,
    private smsService: SMSService
  ) {}

  async create(
    createOpportunityDto: Partial<Opportunity>,
    createdById?: string
  ) {
    try {
      return this.opportunityModel.sequelize.transaction(async (t) => {
        const createdOpportunity = await this.opportunityModel.create(
          {
            ...createOpportunityDto,
            createdBy: createdById,
          },
          { hooks: true, transaction: t }
        );

        if (
          (
            createOpportunityDto as
              | CreateExternalOpportunityDto
              | CreateOpportunityDto
          ).businessLines
        ) {
          const businessLines = await Promise.all(
            (
              createOpportunityDto as
                | CreateExternalOpportunityDto
                | CreateOpportunityDto
            ).businessLines.map(({ name, order = -1 }) => {
              return this.businessLineModel.create(
                { name, order },
                { hooks: true, transaction: t }
              );
            })
          );
          await createdOpportunity.$add('businessLines', businessLines, {
            transaction: t,
          });
        }

        return createdOpportunity;
      });
    } catch (error) {
      throw error;
    }
  }

  async findAllCandidatesIdsToRecommendOfferTo(
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

  async findAllIds() {
    return this.opportunityModel.findAll({ attributes: ['id'] });
  }

  async findAll(
    query: {
      type: OfferAdminTab;
      search: string;
      offset: number;
      limit: number;
    } & FilterParams<OfferFilterKey>
  ) {
    const {
      typeParams,
      statusParams,
      searchOptions,
      businessLinesOptions,
      filterOptions,
    } = destructureOptionsAndParams(query);

    const options = {
      include: [
        ...OpportunityCompleteAdminWithoutBusinessLinesInclude,
        businessLinesOptions,
      ],
    };

    if (typeParams && typeParams === OfferAdminTabs.EXTERNAL) {
      delete filterOptions.isPublic;
    }

    const limit = query.limit || LIMIT;

    const opportunities = await this.opportunityModel.findAll({
      ...options,
      where: {
        ...searchOptions,
        ...filterOptions,
      },
      offset: query.offset ? query.offset * limit : 0,
      limit,
    });

    const cleanedOpportunites = opportunities.map((opportunity) => {
      return opportunity.toJSON();
    });

    const filteredTypeOpportunites = filterAdminOffersByType(
      cleanedOpportunites,
      typeParams as OfferAdminTab
    );

    return filterOffersByStatus(filteredTypeOpportunites, statusParams);
  }

  async findAllUserOpportunitiesAsAdmin(
    candidateId: string,
    opportunityUsersIds: string[],
    query: {
      search: string;
    } & FilterParams<OfferFilterKey>
  ) {
    const { statusParams, searchOptions, businessLinesOptions, filterOptions } =
      destructureOptionsAndParams(query);

    const options = {
      include: [
        ...OpportunityCompleteAdminWithoutBusinessLinesInclude,
        businessLinesOptions,
      ],
    };

    const opportunities = await this.opportunityModel.findAll({
      ...options,
      where: {
        id: opportunityUsersIds,
        ...searchOptions,
        ...filterOptions,
      },
    });

    const cleanedOpportunities = opportunities.map((opportunity) => {
      return opportunity.toJSON();
    });

    const filterOpportunitiesByStatus = filterOffersByStatus(
      cleanedOpportunities,
      statusParams,
      candidateId
    );

    return sortOpportunities(filterOpportunitiesByStatus, candidateId);
  }

  async findAllAsCandidate(
    candidateId: string,
    query: {
      type: OfferCandidateTab;
      search: string;
      offset: number;
      limit: number;
    } & FilterParams<OfferFilterKey>
  ) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    const { includeOptions, whereOptions } = renderOffersQuery(
      candidateId,
      query
    );

    const limit = query.limit || LIMIT;

    const opportunities = await this.opportunityModel.findAll({
      attributes: [...OpportunityCandidateAttributes],
      include: includeOptions,
      where: whereOptions,
      offset: query.offset ? query.offset * limit : 0,
      limit,
      order: [['createdAt', 'DESC']],
    });

    return opportunities.map((opportunity) => {
      const cleanedOpportunity = opportunity.toJSON();
      const opportunityUser = opportunity.opportunityUsers[0];
      const { opportunityUsers, ...opportunityWithoutOpportunityUsers } =
        cleanedOpportunity;
      return {
        ...opportunityWithoutOpportunityUsers,
        opportunityUsers: opportunityUser,
      } as OpportunityRestricted;
    });
  }

  async findOne(id: string) {
    return this.opportunityModel.findByPk(id, {
      include: OpportunityCompleteInclude,
    });
  }

  async findOneAsCandidate(
    id: string,
    candidateId: string | string[]
  ): Promise<OpportunityRestricted> {
    const opportunity = await this.opportunityModel.findOne({
      where: {
        [Op.or]: [
          { isValidated: true, isExternal: false, isArchived: false, id },
          { isExternal: true, isArchived: false, id },
        ],
      },
      attributes: [...OpportunityCandidateAttributes],
      include: OpportunityCompleteWithoutOpportunityUsersInclude,
    });

    if (!opportunity) {
      return null;
    }

    const opportunityUser = Array.isArray(candidateId)
      ? (
          await Promise.all(
            candidateId.map((singleCandidateId) => {
              return this.opportunityUsersService.findOneByCandidateIdAndOpportunityId(
                singleCandidateId,
                id
              );
            })
          )
        ).filter((opportunityUser) => !!opportunityUser)
      : await this.opportunityUsersService.findOneByCandidateIdAndOpportunityId(
          candidateId,
          id
        );

    if (_.isEmpty(opportunityUser) && !opportunity.isPublic) {
      return null;
    }

    return {
      ...opportunity.toJSON(),
      opportunityUsers: Array.isArray(opportunityUser)
        ? opportunityUser.map((singleOpportunityUser) =>
            singleOpportunityUser?.toJSON()
          )
        : opportunityUser?.toJSON(),
    } as OpportunityRestricted;
  }

  async findOneCandidate(candidateId: string) {
    const user = await this.usersService.findOne(candidateId);
    if (!user || !isRoleIncluded(CandidateUserRoles, user.role)) {
      return null;
    }
    return user;
  }

  async update(
    id: string,
    updateOpportunityDto:
      | Omit<UpdateOpportunityDto, 'shouldSendNotifications'>
      | UpdateExternalOpportunityDto
  ) {
    try {
      return this.opportunityModel.sequelize.transaction(async (t) => {
        await this.opportunityModel.update(updateOpportunityDto, {
          where: { id },
          individualHooks: true,
          transaction: t,
        });

        const updatedOpportunity = await this.findOne(id);

        if (updateOpportunityDto.businessLines) {
          const businessLines = await Promise.all(
            updateOpportunityDto.businessLines.map(({ name, order = -1 }) => {
              return this.businessLineModel.create(
                { name, order },
                { hooks: true, transaction: t }
              );
            })
          );
          await updatedOpportunity.$add('businessLines', businessLines, {
            transaction: t,
          });

          await this.opportunityBusinessLineModel.destroy({
            where: {
              OpportunityId: updatedOpportunity.id,
              BusinessLineId: {
                [Op.not]: businessLines.map((bl) => {
                  return bl.id;
                }),
              },
            },
            hooks: true,
            transaction: t,
          });
        }

        return updatedOpportunity;
      });
    } catch (error) {
      throw error;
    }
  }

  async updateAll(
    attributes: Omit<
      UpdateOpportunityDto,
      | 'id'
      | 'shouldSendNotifications'
      | 'candidatesIds'
      | 'isAdmin'
      | 'isCopy'
      | 'locations'
    >,
    opportunitiesId: string[]
  ) {
    const [nbUpdated, updatedOpportunities] =
      await this.opportunityModel.update(attributes, {
        where: { id: opportunitiesId },
        returning: true,
        individualHooks: true,
      });

    return {
      nbUpdated,
      updatedIds: updatedOpportunities.map((opp) => {
        return opp.id;
      }),
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

  async countPending(zone: AdminZone) {
    const locationFilters = DepartmentFilters.filter((dept) => {
      return zone === dept.zone;
    });
    const filterOptions =
      locationFilters.length > 0
        ? getOfferOptions({ department: locationFilters })
        : {};

    const pendingOpportunitiesCount = await this.opportunityModel.count({
      where: {
        ...filterOptions,
        isValidated: false,
        isArchived: false,
      },
    });

    return {
      pendingOpportunities: pendingOpportunitiesCount,
    };
  }

  async countUnseen(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      throw new NotFoundException();
    }

    const opportunityUsers =
      await this.opportunityUsersService.findAllByCandidateId(candidateId);

    const unseenOpportunities = await Opportunity.count({
      where: {
        id: opportunityUsers
          .filter(({ seen, archived }) => {
            return !seen && !archived;
          })
          .map((model) => {
            return model.OpportunityId;
          }),
        isPublic: false,
        isValidated: true,
        isArchived: false,
      },
    });

    return {
      unseenOpportunities,
    };
  }

  async associateCandidatesToOpportunity(
    opportunity: Opportunity,
    candidatesIds: string[]
  ) {
    // disable auto recommandation feature
    // const candidatesIdsToRecommendTo =
    //   opportunity.isPublic && opportunity.isValidated
    //     ? await this.findAllCandidatesIdsToRecommendOfferTo(
    //         opportunity.department,
    //         opportunity.businessLines
    //       )
    //     : [];

    if (
      candidatesIds?.length > 0
      // || candidatesIdsToRecommendTo?.length > 0
    ) {
      const uniqueCandidatesIds = _.uniq([
        ...(candidatesIds || []),
        // ...(candidatesIdsToRecommendTo || []),
      ]);

      await Promise.all(
        uniqueCandidatesIds.map((candidateId) => {
          return this.opportunityUsersService.createOrRestore({
            OpportunityId: opportunity.id,
            UserId: candidateId,
            recommended: opportunity.isPublic,
          });
        })
      );

      return this.opportunityUsersService.findAllByCandidatesIdsAndOpportunityId(
        uniqueCandidatesIds,
        opportunity.id
      );
    }
    return null;
  }

  async updateAssociatedCandidatesToOpportunity(
    opportunity: Opportunity,
    oldOpportunity: Opportunity,
    candidatesIds?: string[]
  ) {
    // const candidatesToRecommendTo =
    //   opportunity.isPublic &&
    //   !oldOpportunity.isValidated &&
    //   opportunity.isValidated
    //     ? await this.findAllCandidatesIdsToRecommendOfferTo(
    //         opportunity.department,
    //         opportunity.businessLines
    //       )
    //     : [];

    const uniqueCandidatesIds = _.uniq([
      ...(candidatesIds ||
        opportunity.opportunityUsers.map(({ UserId }) => UserId) ||
        []),
      // ...(candidatesToRecommendTo || []),
    ]);
    try {
      await this.opportunityModel.sequelize.transaction(async (t) => {
        const opportunityUsers = await Promise.all(
          uniqueCandidatesIds.map(async (candidateId) => {
            return this.opportunityUsersService.createOrRestore(
              {
                OpportunityId: opportunity.id,
                UserId: candidateId,
              },
              t
            );
          })
        );

        if (opportunity.isPublic) {
          await this.opportunityUserModel.update(
            {
              recommended: true,
            },
            {
              where: {
                id: opportunityUsers.map((opportunityUser) => {
                  return opportunityUser.id;
                }),
              },
              hooks: true,
              transaction: t,
            }
          );
          await this.opportunityUserModel.update(
            {
              recommended: false,
            },
            {
              where: {
                OpportunityId: opportunity.id,
                UserId: {
                  [Op.not]: opportunityUsers.map((opportunityUser) => {
                    return opportunityUser.UserId;
                  }),
                },
              },
              hooks: true,
              transaction: t,
            }
          );
        } else {
          const opportunitiesUsersToDestroy =
            await this.opportunityUserModel.findAll({
              where: {
                OpportunityId: opportunity.id,
                UserId: {
                  [Op.not]: opportunityUsers.map((opportunityUser) => {
                    return opportunityUser.UserId;
                  }),
                },
              },
              transaction: t,
            });
          await Promise.all(
            opportunitiesUsersToDestroy.map((oppUs) => {
              return this.opportunityUserStatusChangeModel.create(
                {
                  oldStatus: oppUs.status,
                  newStatus: null,
                  OpportunityUserId: oppUs.id,
                  UserId: oppUs.UserId,
                  OpportunityId: opportunity.id,
                },
                { transaction: t }
              );
            })
          );
          await this.opportunityUserModel.destroy({
            where: {
              OpportunityId: opportunity.id,
              UserId: opportunitiesUsersToDestroy.map((opportunityUser) => {
                return opportunityUser.UserId;
              }),
            },
            transaction: t,
          });
        }
      });
    } catch (error) {
      throw error;
    }

    // Check case where the opportunity has become private and has candidates, to see if there are any new candidates to send mail to
    const newCandidatesIdsToSendMailTo =
      opportunity.isValidated && uniqueCandidatesIds
        ? uniqueCandidatesIds.filter((candidateId) => {
            return !oldOpportunity.opportunityUsers.some((oldUserOpp) => {
              return candidateId === oldUserOpp.user.id;
            });
          })
        : null;

    const opportunityUsers =
      await this.opportunityUsersService.findAllByOpportunityId(opportunity.id);

    if (oldOpportunity && opportunityUsers && opportunityUsers.length > 0) {
      // Case where the opportunity was not validated and has been validated, we send the mail to everybody
      if (!oldOpportunity.isValidated && opportunity.isValidated) {
        return opportunity.isPublic
          ? opportunityUsers.filter((userOpp) => {
              return userOpp.recommended;
            })
          : opportunityUsers;
      } else if (newCandidatesIdsToSendMailTo) {
        // Case where the opportunity was already validated, and we just added new candidates to whom we have to send the mail
        return (
          opportunity.isPublic
            ? opportunityUsers.filter((userOpp) => {
                return userOpp.recommended;
              })
            : opportunityUsers
        ).filter((userOpp) => {
          return newCandidatesIdsToSendMailTo.includes(userOpp.user.id);
        });
      }
    }
    return null;
  }

  async sendMailsAfterCreation(
    opportunity: Opportunity,
    candidates: OpportunityUser[],
    isAdmin = false,
    shouldSendNotifications = true
  ) {
    if (!isAdmin) {
      await this.mailsService.sendOnCreatedOfferMail(opportunity);
    } else {
      await this.sendOnValidatedOfferMail(opportunity);
      await this.createArchiveOfferReminderJob(opportunity);
      if (candidates && candidates.length > 0 && shouldSendNotifications) {
        await this.sendCandidateOfferMessages(candidates, opportunity);
      }
    }

    try {
      await this.queuesService.addToWorkQueue(Jobs.NEWSLETTER_SUBSCRIPTION, {
        email: opportunity.contactMail || opportunity.recruiterMail,
        zone: getZoneFromDepartment(opportunity.department),
        status: ContactStatuses.COMPANY,
      });
    } catch (err) {
      console.error(err);
    }
  }

  async sendMailsAfterUpdate(
    opportunity: Opportunity,
    oldOpportunity: Opportunity,
    candidates: OpportunityUser[],
    shouldSendNotifications = true
  ) {
    if (candidates && candidates.length > 0 && shouldSendNotifications) {
      await this.sendCandidateOfferMessages(candidates, opportunity);
    }

    if (!oldOpportunity.isValidated && opportunity.isValidated) {
      await this.sendOnValidatedOfferMail(opportunity);
      // email à prévoir chaque mois pour rappeler le potentiel archivage de l'offre
      await this.createArchiveOfferReminderJob(opportunity);
    }
  }

  async sendMailAfterExternalCreation(
    opportunity: OpportunityRestricted,
    isAdmin = false,
    coachNotification: boolean,
    candidateId: string
  ) {
    if (!isAdmin) {
      await this.mailsService.sendOnCreatedExternalOfferMailToAdmin(
        opportunity
      );
    }
    if (coachNotification && !isAdmin) {
      const candidate = await this.usersService.findOne(candidateId);
      const coach = getCoachFromCandidate(candidate);
      if (coach) {
        await this.mailsService.sendOnCreatedExternalOfferMailToCoach(
          opportunity,
          coach
        );
      }
    }
  }

  async sendOnValidatedOfferMail(opportunity: Opportunity) {
    await this.mailsService.sendOnValidatedOfferMail(opportunity);

    await this.queuesService.addToWorkQueue(
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

  async createArchiveOfferReminderJob(opportunity: Opportunity) {
    await this.queuesService.addToWorkQueue(
      Jobs.OFFER_ARCHIVE_REMINDER,
      {
        opportunityId: opportunity.id,
      },
      {
        delay:
          (process.env.OFFER_ARCHIVE_REMINDER_DELAY
            ? parseFloat(process.env.OFFER_ARCHIVE_REMINDER_DELAY)
            : 30) *
          3600000 *
          24,
      }
    );
  }

  sendArchiveOfferReminder(opportunity: Opportunity) {
    return this.mailsService.sendArchiveOfferReminderMail(opportunity);
  }

  // check and execute if the email should be sent and if should be rescheduled
  async validateAndExecuteArchiveReminder(
    opportunityId: string
  ): Promise<string> {
    let shouldSend = true;
    let shouldReschedule = true;

    const opportunity = await this.findOne(opportunityId);

    // si archivée, ne pas envoyer ni reprogrammer
    if (opportunity.isArchived || !opportunity.isValidated) {
      shouldSend = false;
      shouldReschedule = false;
    } else {
      const oppUsers =
        await this.opportunityUsersService.findAllByOpportunityId(
          opportunityId
        );
      if (oppUsers.length > 0) {
        // s'il existe un process en cours, ne pas envoyer mais reprogrammer
        const existingProcess = oppUsers.find((oppUser) => {
          return (
            !oppUser.archived &&
            oppUser.status === OfferStatuses.INTERVIEW.value
          );
        });
        if (existingProcess) {
          shouldSend = false;
        }
      }
    }

    let log =
      'Archive mail reminder to recruiter for opportunity ' +
      opportunityId +
      ' : ';
    if (shouldSend) {
      await this.sendArchiveOfferReminder(opportunity);
      log += 'mail sent; ';
    } else {
      log += 'no mail sent; ';
    }
    if (shouldReschedule) {
      await this.queuesService.addToWorkQueue(
        Jobs.OFFER_ARCHIVE_REMINDER,
        {
          opportunityId: opportunity.id,
        },
        {
          delay:
            (process.env.OFFER_ARCHIVE_REMINDER_DELAY
              ? parseFloat(process.env.OFFER_ARCHIVE_REMINDER_DELAY)
              : 30) *
            3600000 *
            24,
        }
      );
      log += 'rescheduling after 30 days.';
    } else {
      log += 'no rescheduling.';
    }
    return log;
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
          await this.queuesService.addToWorkQueue(
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

  async sendOnStatusUpdatedMails(
    opportunityUser: OpportunityUser,
    oldOpportunityUser: OpportunityUser
  ) {
    if (
      opportunityUser.status !== oldOpportunityUser.status &&
      opportunityUser.status !== OfferStatuses.CONTACTED.value
    ) {
      const opportunity = await this.findOne(opportunityUser.OpportunityId);
      await this.mailsService.sendOnOfferStatusUpdatedMails(
        opportunityUser,
        opportunity
      );
    }
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

    if (opportunity) {
      const candidate: User = opportunity.opportunityUsers.user;

      const candidatPhone = candidate?.phone;

      await this.smsService.sendReminderAboutOfferSMS(
        candidatPhone,
        opportunity.id
      );

      return this.mailsService.sendReminderOfferMail(opportunity);
    }
  }

  async sendReminderAboutExternalOffers(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    let opportunitiesCreatedByCandidateOrCoach =
      await this.countExternalOpportunitiesCreatedByUser(candidateId);

    const coach = getCoachFromCandidate(candidate);
    if (coach) {
      opportunitiesCreatedByCandidateOrCoach +=
        await this.countExternalOpportunitiesCreatedByUser(coach.id);
    }

    if (opportunitiesCreatedByCandidateOrCoach === 0) {
      return this.mailsService.sendExternalOffersReminderMails(
        candidate.toJSON()
      );
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

  async findRelevantOpportunities(
    locations: Department[],
    businessLinesNames: BusinessLineValue[],
    period: Date
    // other parameters might be added
  ) {
    return this.opportunityModel.findAll({
      where: {
        isPublic: true,
        isValidated: true,
        department: {
          [Op.in]: locations,
        },
        createdAt: {
          [Op.gt]: period,
        },
      },
      include: [
        {
          model: BusinessLine,
          as: 'businessLines',
          where: {
            name: {
              [Op.in]: businessLinesNames,
            },
          },
        },
      ],
    });
  }

  async sendRelevantOpportunities(
    candidateId: string,
    locations: Location[],
    businessLines: BusinessLine[]
  ) {
    const user = await this.usersService.findOne(candidateId);
    const autoRecommendationsZone = process.env.AUTO_RECOMMENDATIONS_ZONE;
    if (
      (autoRecommendationsZone && user.zone !== autoRecommendationsZone) ||
      locations?.length === 0 ||
      businessLines?.length === 0
    ) {
      return `No offer for this user ${user.email} - job send relevant opportunities after cv publish`;
    }
    const lastMonth = moment().subtract(30, 'd').toDate();
    const businessLinesNames: BusinessLineValue[] = businessLines.map((bl) => {
      return bl.name;
    });
    const locationsName: Department[] = locations.map((loc) => {
      return loc.name;
    });
    const opportunities = await this.findRelevantOpportunities(
      locationsName,
      businessLinesNames,
      lastMonth
    );
    if (opportunities.length > 0) {
      opportunities.map(async (model) => {
        // add to table opportunity_user
        await this.opportunityUsersService.findOrCreateByCandidateIdAndOpportunityId(
          candidateId,
          model.id,
          {
            recommended: true,
          }
        );
      });
      await this.mailsService.sendRelevantOpportunitiesMail(
        user,
        opportunities
      );
    } else {
      return `No offer for ${user.email}`;
    }
    return `${opportunities.length} offer(s) were sent to ${user.email} - job send relevant opportunities after cv publish`;
  }

  async refreshSalesforceOpportunities(opportunitiesIds: string[]) {
    return this.externalDatabasesService.refreshSalesforceOpportunities(
      opportunitiesIds
    );
  }

  async sendContactEmployer(
    type: string,
    candidateId: string,
    opportunity: Opportunity,
    description: string
  ) {
    const candidate = await this.usersService.findOne(candidateId);
    return this.mailsService.sendMailContactEmployer(
      type,
      candidate,
      opportunity,
      description
    );
  }


  async adminCountOfferByType(
    type: OfferAdminTab,
    search: string,
    businessLines: string[],
    department: string[],
    contracts: string[],
  ) {
  
    const {
      typeParams,
      searchOptions,
      filterOptions,
    } = destructureOptionsAndParams({type, search, businessLines, department});
  
    // const typeCounts = await this.opportunityModel.sequelize.query()
  
    // console.log("before destructure")
    // console.log({typeParams,  searchOptions,
    // businessLinesOptions,
    // filterOptions})
    // console.log("after destructure")

    console.log("type params", typeParams);

    const pendingOpportunitiesCount = await this.opportunityModel.count({
      where: {
        ...searchOptions,
        ...filterOptions,
        department,
        isValidated: false,
        isArchived: false,
      },
    });

    // const cleanedOpportunites = pendingOpportunitiesCount.map((opportunity) => {
    //   return opportunity.toJSON();
    // });

    console.log({type, search, businessLines, department, contracts});

    return {pending: pendingOpportunitiesCount}
  }
}
