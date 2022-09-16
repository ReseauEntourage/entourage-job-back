import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bull';
import * as _ from 'lodash';
import { Op } from 'sequelize';
import { CVsService } from '../cvs/cvs.service';
import { ContactStatus, ContactStatuses } from '../mails/mails.types';
import { getRelatedUser } from '../users/users.utils';
import { BusinessLine } from 'src/businessLines/models';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { Department, DepartmentFilters } from 'src/locations/locations.types';
import { MailchimpService } from 'src/mails/mailchimp.service';
import { MailsService } from 'src/mails/mails.service';
import { Jobs, Queues } from 'src/queues/queues.types';
import { SMSService } from 'src/sms/sms.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { getZoneFromDepartment } from 'src/utils/misc';
import { AdminZone, FilterObject, FilterParams } from 'src/utils/types';
import { CreateExternalOpportunityRestrictedDto } from './dto/create-external-opportunity-restricted.dto';
import { CreateExternalOpportunityDto } from './dto/create-external-opportunity.dto';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import {
  Opportunity,
  OpportunityBusinessLine,
  OpportunityUser,
} from './models';
import { OpportunityCandidateAttributes } from './models/opportunity.attributes';
import {
  OpportunityCompleteAdminWithoutBusinessLinesInclude,
  OpportunityCompleteInclude,
  OpportunityCompleteWithoutBusinessLinesInclude,
  OpportunityCompleteWithoutOpportunityUsersInclude,
} from './models/opportunity.include';
import {
  OfferAdminTab,
  OfferAdminTabs,
  OfferCandidateTab,
  OfferCandidateTabFilters,
  OfferCandidateTabs,
  OfferFilterKey,
  OfferOptions,
  OpportunityRestricted,
} from './opportunities.types';
import {
  destructureOptionsAndParams,
  filterAdminOffersByType,
  filterCandidateOffersByType,
  filterOffersByStatus,
  getOfferOptions,
  sortOpportunities,
} from './opportunities.utils';
import { OpportunityUsersService } from './opportunity-users.service';

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
    @InjectQueue(Queues.WORK)
    private workQueue: Queue,
    private mailchimpService: MailchimpService,
    private opportunityUsersService: OpportunityUsersService,
    private usersService: UsersService,
    private cvsService: CVsService,
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
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    const createdOpportunity = await this.opportunityModel.create({
      ...createExternalOpportunityDto,
      isExternal: true,
      isPublic: false,
      isArchived: false,
      isValidated: true,
      createdBy: createdById,
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

    await this.opportunityUsersService.create({
      OpportunityId: createdOpportunity.id,
      UserId: candidateId,
    });

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

  async findAll(
    query: {
      type: OfferAdminTab;
      search: string;
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

    const opportunities = await this.opportunityModel.findAll({
      ...options,
      where: {
        ...searchOptions,
        ...filterOptions,
      },
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
    opportunityUserIds: string[],
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
        id: opportunityUserIds,
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
    opportunityUserIds: string[],
    query: {
      type: OfferCandidateTab;
      search: string;
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
      attributes: [...OpportunityCandidateAttributes],
      include: [
        ...OpportunityCompleteWithoutBusinessLinesInclude,
        businessLinesOptions,
      ],
    };

    const opportunities = await this.opportunityModel.findAll({
      ...options,
      where: {
        [Op.or]: [
          { isPublic: true, isValidated: true, isArchived: false },
          {
            id: opportunityUserIds,
            isPublic: false,
            isValidated: true,
            isArchived: false,
          },
        ],
        ...searchOptions,
        ...filterOptions,
      },
    });

    const finalOpportunities = opportunities.map((opportunity) => {
      const cleanedOpportunity = opportunity.toJSON();
      if (
        opportunity.opportunityUsers &&
        opportunity.opportunityUsers.length > 0
      ) {
        opportunity.opportunityUsers.sort(
          (a: OpportunityUser, b: OpportunityUser) => {
            return b.updatedAt - a.updatedAt;
          }
        );
      }
      const opportunityUser = opportunity.opportunityUsers.find(
        (opportunityUser) => {
          return opportunityUser.UserId === candidateId;
        }
      );

      const { opportunityUsers, ...opportunityWithoutOpportunityUsers } =
        cleanedOpportunity;
      return {
        ...opportunityWithoutOpportunityUsers,
        opportunityUsers: opportunityUser,
      } as OpportunityRestricted;
    });

    const sortedOpportunities = sortOpportunities(
      finalOpportunities,
      candidateId,
      typeParams === OfferCandidateTabs.PRIVATE
    );

    const filteredTypeOpportunities = filterCandidateOffersByType(
      sortedOpportunities as OpportunityRestricted[],
      typeParams as OfferCandidateTab
    );

    return filterOffersByStatus(
      filteredTypeOpportunities,
      statusParams,
      candidateId
    );
  }

  async findOne(id: string) {
    return this.opportunityModel.findByPk(id, {
      include: OpportunityCompleteInclude,
    });
  }

  async findOneAsCandidate(
    id: string,
    candidateId: string
  ): Promise<OpportunityRestricted> {
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
      include: OpportunityCompleteWithoutOpportunityUsersInclude,
    });

    if (!opportunity) {
      return null;
    }

    return {
      ...opportunity.toJSON(),
      opportunityUsers: opportunityUser.toJSON(),
    } as OpportunityRestricted;
  }

  async update(
    id: string,
    updateOpportunityDto: Omit<
      UpdateOpportunityDto,
      'id' | 'shouldSendNotifications'
    >
  ) {
    await this.opportunityModel.update(updateOpportunityDto, {
      where: { id },
      individualHooks: true,
    });

    const updatedOpportunity = await this.findOne(id);

    if (updatedOpportunity.businessLines) {
      const businessLines = await Promise.all(
        updatedOpportunity.businessLines.map(({ name, order = -1 }) => {
          return BusinessLine.create({ name, order });
        })
      );
      await updatedOpportunity.$add('businessLines', businessLines);
      await this.opportunityBusinessLineModel.destroy({
        where: {
          OpportunityId: updatedOpportunity.id,
          BusinessLineId: {
            [Op.not]: businessLines.map((bl) => {
              return bl.id;
            }),
          },
        },
      });
    }

    return updatedOpportunity;
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
    const cv = await this.cvsService.findOneByCandidateId(candidateId);

    const locationFilters = DepartmentFilters.filter((dept) => {
      return cv.locations && cv.locations.length > 0
        ? cv.locations.map((location) => location.name).includes(dept.value)
        : candidate.zone === dept.zone;
    });

    const filters = {} as FilterObject<OfferFilterKey>;
    if (locationFilters.length > 0) {
      filters.department = locationFilters;
    }

    const filterOptions =
      Object.keys(filters).length > 0
        ? getOfferOptions(filters)
        : ({} as OfferOptions);

    const { businessLines: businessLinesOptions, ...restFilterOptions } =
      filterOptions;

    const opportunityUsers =
      await this.opportunityUsersService.findAllByCandidateId(candidateId);

    const opportunities = await Opportunity.findAll({
      include: [
        ...OpportunityCompleteWithoutBusinessLinesInclude,
        {
          model: BusinessLine,
          as: 'businessLines',
          attributes: ['name', 'order'],
          through: { attributes: [] },
          ...(businessLinesOptions
            ? {
                where: {
                  name: businessLinesOptions,
                },
              }
            : {}),
        },
      ],
      where: {
        [Op.or]: [
          { isPublic: true, isValidated: true },
          {
            id: opportunityUsers.map((model) => {
              return model.OpportunityId;
            }),
            isPublic: false,
            isValidated: true,
          },
        ],
        ...restFilterOptions,
      },
    });

    const filteredOpportunities = opportunities
      .map((opportunity) => {
        return opportunity.toJSON();
      })
      .filter((opportunity: Opportunity) => {
        return (
          !opportunity.opportunityUsers ||
          opportunity.opportunityUsers.length === 0 ||
          !opportunity.opportunityUsers.find((opp) => {
            return opp.UserId === candidateId;
          }) ||
          opportunity.opportunityUsers.find((opp) => {
            return opp.UserId === candidateId;
          }).seen === false
        );
      });

    return {
      unseenOpportunities: filteredOpportunities.length,
    };
  }

  async associateCandidatesToOpportunity(
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

  async updateAssociatedCandidatesToOpportunity(
    opportunity: Opportunity,
    oldOpportunity: Opportunity,
    candidatesId: string[]
  ) {
    const candidatesToRecommendTo = opportunity.isPublic
      ? await this.findAllCandidateIdsToRecommendOfferTo(
          opportunity.department,
          opportunity.businessLines
        )
      : [];

    const uniqueCandidatesIds = _.uniq([
      ...(candidatesId || []),
      ...(candidatesToRecommendTo || []),
    ]);

    const t = await this.opportunityUserModel.sequelize.transaction();
    try {
      if (uniqueCandidatesIds?.length > 0) {
        const opportunityUsers = await Promise.all(
          uniqueCandidatesIds.map((candidatId) => {
            return this.opportunityUserModel
              .findOrCreate({
                where: {
                  OpportunityId: opportunity.id,
                  UserId: candidatId,
                },
                transaction: t,
              })
              .then((model) => {
                return model[0];
              });
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
              transaction: t,
            }
          );
        } else {
          await this.opportunityUserModel.destroy({
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
        }
      }

      await t.commit();
    } catch (error) {
      await t.rollback();
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
      await this.opportunityUsersService.findAllByCandidateIdsAndOpportunityId(
        newCandidatesIdsToSendMailTo,
        opportunity.id
      );

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
    }
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
