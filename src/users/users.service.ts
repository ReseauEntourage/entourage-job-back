import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bull';
import { col, Op, where } from 'sequelize';
import { CustomMailParams, MailjetService, MailsService } from 'src/mails';
import { Jobs, Queues } from 'src/queues';
import { getFiltersObjectsFromQueryParams } from 'src/utils/misc';
import { UpdateUserDto } from './dto';
import { UserCandidat, UserCandidatAttributes, UserAttributes } from './models';
import { UserCandidatInclude } from './models/user.include';
import {
  BusinessLineFilter,
  getRelatedUser,
  MemberFilter,
  MemberFilterParams,
  MemberFilters,
  User,
  UserRole,
  UserRoles,
} from './models/user.model';

/*
function getMemberOptions(filtersObj) {
  const whereOptions = {};

  if (filtersObj) {
    const keys = Object.keys(filtersObj);

    if (keys.length > 0) {
      const totalFilters = keys.reduce((acc, curr) => {
        return acc + filtersObj[curr].length;
      }, 0);

      if (totalFilters > 0) {
        for (let i = 0; i < keys.length; i += 1) {
          if (filtersObj[keys[i]].length > 0) {
            if (
              keys[i] === MemberFilters[3].key ||
              keys[i] === MemberFilters[4].key
            ) {
              whereOptions[keys[i]] = {
                [Op.or]: filtersObj[keys[i]].map(
                  (currentFilter: MemberFilter) => {
                    return currentFilter.value;
                  }
                ),
              };
            } else if (keys[i] === MemberFilters[2].key) {
              // These options don't work
              whereOptions[keys[i]] = {
                coach: filtersObj[keys[i]].map(
                  (currentFilter: MemberFilter) => {
                    return where(
                      col(`coach.candidatId`),
                      currentFilter.value ? Op.is : Op.not,
                      null
                    );
                  }
                ),
                candidat: filtersObj[keys[i]].map(
                  (currentFilter: MemberFilter) => {
                    return where(
                      col(`candidat.coachId`),
                      currentFilter.value ? Op.is : Op.not,
                      null
                    );
                  }
                ),
              };
            } else {
              whereOptions[keys[i]] = {
                [Op.or]: filtersObj[keys[i]].map((currentFilter) => {
                  return currentFilter.value;
                }),
              };
            }
          }
        }
      }
    }
  }

  return whereOptions;
}

function filterMembersByCVStatus(members, status) {
  let filteredList = members;

  if (members && status) {
    filteredList = members.filter((member) => {
      return status.some((currentFilter) => {
        if (member.candidat && member.candidat.cvs.length > 0) {
          return currentFilter.value === member.candidat.cvs[0].status;
        }
        return false;
      });
    });
  }

  return filteredList;
}

function filterMembersByBusinessLines(
  members: Array<User>,
  businessLines: Array<BusinessLineFilter>
) {
  let filteredList = members;

  if (members && businessLines && businessLines.length > 0) {
    filteredList = members.filter((member: User) => {
      return businessLines.some((currentFilter) => {
        if (member.candidat && member.candidat.cvs.length > 0) {
          const cvBusinessLines = member.candidat.cvs[0].businessLines;
          return (
            cvBusinessLines &&
            cvBusinessLines.length > 0 &&
            cvBusinessLines
              .map(({ name }: { name: BusinessLineFilter['name'] }) => {
                return name;
              })
              .includes(currentFilter.value)
          );
        }
        return false;
      });
    });
  }

  return filteredList;
}

function filterMembersByAssociatedUser(members, associatedUsers) {
  let filteredList = members;

  if (members && associatedUsers && associatedUsers.length > 0) {
    filteredList = members.filter((member) => {
      return associatedUsers.some((currentFilter) => {
        const candidate = getCandidateFromCoachOrCandidate(member);
        const relatedUser = getRelatedUser(member);
        if (!candidate) {
          return !currentFilter.value;
        }
        return !!relatedUser === currentFilter.value;
      });
    });
  }

  return filteredList;
}
*/

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private mailsService: MailsService,
    private mailjetService: MailjetService
  ) {}

  async create(createUserDto: Partial<User>) {
    return this.userModel.create(createUserDto, { hooks: true });
  }

  async findAllMembers(
    params: {
      limit: number;
      offset: number;
      search: string;
      order: string[][];
      role: UserRole | 'All';
    } & MemberFilterParams
  ) {
    const { limit, offset, role, search, order, ...restParams } = params;

    /*const filtersObj = getFiltersObjectsFromQueryParams(
      restParams,
      MemberFilters
    );

    const { businessLines, cvStatus, associatedUser, ...restFilters } =
      filtersObj;

    // The associatedUser options don't work that's why we take it out of the filters
    const filterOptions = getMemberOptions(restFilters);

    const options = {
      order,
      where: {
        role: { [Op.not]: UserRoles.ADMIN },
      },
      attributes: UserAttributes,
      include: UserCandidatInclude,
    };

    const hasFilterOptions = Object.keys(filtersObj).length > 0;

    if (!hasFilterOptions) {
      options.offset = offset;
      options.limit = limit;
    }
    // recherche de l'utilisateur
    if (search) {
      options.where = {
        ...options.where,
        [Op.or]: userSearchQuery(search),
      };
    }
    if (filterOptions.zone) {
      options.where = {
        ...options.where,
        zone: filterOptions.zone,
      };
    }

    // filtre par role
    if (role === UserRoles.CANDIDAT || role === UserRoles.COACH) {
      options.where = {
        ...options.where,
        role,
      };
    }

    const userCandidatOptions = {};
    if (
      (role === UserRoles.CANDIDAT || role === 'All') &&
      (filterOptions.hidden || filterOptions.employed)
    ) {
      userCandidatOptions.where = {};
      if (filterOptions.hidden) {
        userCandidatOptions.where = {
          ...userCandidatOptions.where,
          hidden: filterOptions.hidden,
        };
      }
      if (filterOptions.employed) {
        userCandidatOptions.where = {
          ...userCandidatOptions.where,
          employed: filterOptions.employed,
        };
      }
    }

    // TODO filter associated users in query
    /!*
      if (filterOptions.associatedUser) {
        userCandidatOptions.where = {
          ...(userCandidatOptions.where || {}),
          ...filterOptions.associatedUser.candidat,
        };
      }
    *!/

    // recuperer la derniere version de cv
    options.include = [
      {
        model: UserCandidat,
        as: 'candidat',
        attributes: ['coachId', ...UserCandidatAttributes],
        ...userCandidatOptions,
        include: [
          {
            model: CV,
            as: 'cvs',
            attributes: ['version', 'status', 'urlImg'],
            include: [
              {
                model: BusinessLine,
                as: 'businessLines',
                attributes: ['name', 'order'],
                through: { attributes: [] },
              },
            ],
          },
          {
            model: User,
            as: 'coach',
            attributes: UserAttributes,
          },
        ],
        order: [['cvs.version', 'DESC']],
      },
      {
        model: UserCandidat,
        as: 'coach',
        attributes: ['candidatId', ...UserCandidatAttributes],
        include: [
          {
            model: User,
            as: 'candidat',
            attributes: UserAttributes,
          },
        ],
      },
    ];

    const members = await User.findAll(options);

    const filteredMembersByAssociatedUser = filterMembersByAssociatedUser(
      members,
      associatedUser
    );

    const membersWithLastCV = filteredMembersByAssociatedUser.map((member) => {
      const user = member.toJSON();
      if (user.candidat && user.candidat.cvs && user.candidat.cvs.length > 0) {
        const sortedCvs = user.candidat.cvs.sort((cv1, cv2) => {
          return cv2.version - cv1.version;
        });
        return {
          ...user,
          candidat: {
            ...user.candidat,
            cvs: [sortedCvs[0]],
          },
        };
      }
      return user;
    });

    let finalFilteredMembers = membersWithLastCV;

    if (role === UserRoles.CANDIDAT || role === 'All') {
      const filteredMembersByCVStatus = filterMembersByCVStatus(
        membersWithLastCV,
        cvStatus
      );
      finalFilteredMembers = filterMembersByBusinessLines(
        filteredMembersByCVStatus,
        businessLines
      );
    }

    if (hasFilterOptions && (offset || limit)) {
      if (offset && limit) {
        const intOffset = parseInt(offset, 10);
        const intLimit = parseInt(limit, 10);
        return finalFilteredMembers.slice(intOffset, intOffset + intLimit);
      }
      if (offset) {
        const intOffset = parseInt(offset, 10);
        return finalFilteredMembers.slice(intOffset);
      }
      if (limit) {
        const intLimit = parseInt(limit, 10);

        return finalFilteredMembers.slice(0, intLimit);
      }
    }
    return finalFilteredMembers;*/
  }

  async findOne(id: string) {
    return this.userModel.findByPk(id, {
      attributes: [...UserAttributes],
      include: UserCandidatInclude,
    });
  }

  async findOneByMail(email: string) {
    return this.userModel.findOne({
      where: { email: email.toLowerCase() },
      attributes: [...UserAttributes, 'salt', 'password'],
      include: UserCandidatInclude,
    });
  }

  async findOneComplete(id: string) {
    return this.userModel.findByPk(id, {
      include: UserCandidatInclude,
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const [updateCount] = await this.userModel.update(updateUserDto, {
      where: { id },
      individualHooks: true,
    });

    if (updateCount === 0) {
      return null;
    }

    const updatedUser = await this.findOne(id);

    return updatedUser.toJSON();
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  // TODO call MailjetService through MailsService


  async sendReminderAboutCV(candidateId: string, is20Days = false) {
    // TODO when CV
    /*const firstOfMarch2022 = '2022-03-01';
    const user = await this.findOne(candidateId);
    if (
      moment(user.createdAt).isAfter(moment(firstOfMarch2022, 'YYYY-MM-DD'))
    ) {
      const cvs = await getAllUserCVsVersions(candidateId);
      if (cvs && cvs.length > 0) {
        const hasSubmittedAtLeastOnce = cvs.some(
          ({ status }: { status: CvStatus }) => {
            return status === CvStatuses.Pending;
          }
        );

        if (!hasSubmittedAtLeastOnce) {
          const toEmail: CustomMailParams['toEmail'] = {
            to: user.email,
          };
          const coach = getRelatedUser(user);
          if (coach) {
            toEmail.cc = coach.email;
          }
          const { candidatesAdminMail } = getAdminMailsFromZone(user.zone);

          await this.mailjetService.sendMail({
            toEmail,
            templateId: is20Days
              ? MailjetTemplates.CV_REMINDER_20
              : MailjetTemplates.CV_REMINDER_10,
            replyTo: candidatesAdminMail,
            variables: {
              ..._.omitBy(user.toJSON(), _.isNil),
            },
          });
          return toEmail;
        }
      }
    }
    return false;
  }*/

  /*
  async sendReminderIfNotEmployed(
    candidateId: string,
    templateId: MailjetTemplate
  ) {
    const user = await this.findOne(candidateId);
    if (!user.candidat.employed) {
      const toEmail: CustomMailParams['toEmail'] = {
        to: user.email,
      };
      const coach = getRelatedUser(user);
      if (coach) {
        toEmail.cc = coach.email;
      }
      const { candidatesAdminMail } = getAdminMailsFromZone(user.zone);

      await this.mailjetService.sendMail({
        toEmail,
        templateId: templateId,
        replyTo: candidatesAdminMail,
        variables: {
          ..._.omitBy(user.toJSON(), _.isNil),
        },
      });
      return toEmail;
    }
    return false;
  }

  async sendReminderAboutInterviewTraining(candidateId: string) {
    return this.sendReminderIfNotEmployed(
      candidateId,
      MailjetTemplates.INTERVIEW_TRAINING_REMINDER
    );
  }

  async sendReminderAboutVideo(candidateId: string) {
    return this.sendReminderIfNotEmployed(
      candidateId,
      MailjetTemplates.VIDEO_REMINDER
    );
  }

  async sendReminderAboutActions(candidateId: string) {
    return this.sendReminderIfNotEmployed(
      candidateId,
      MailjetTemplates.ACTIONS_REMINDER
    );
  }

  async sendReminderAboutExternalOffers(candidateId: string) {
    const user = await getUser(candidateId);
    if (!user.candidat.employed) {
      const toEmail: CustomMailParams['toEmail'] = {
        to: user.email,
      };

      let opportunitiesCreatedByCandidateOrCoach =
        await getExternalOpportunitiesCreatedByUserCount(candidateId);

      const coach = getRelatedUser(user);
      if (coach) {
        toEmail.cc = coach.email;
        opportunitiesCreatedByCandidateOrCoach +=
          await getExternalOpportunitiesCreatedByUserCount(coach.id);
      }
      const { candidatesAdminMail } = getAdminMailsFromZone(user.zone);

      if (opportunitiesCreatedByCandidateOrCoach === 0) {
        await this.mailjetService.sendMail({
          toEmail,
          templateId: MailjetTemplates.EXTERNAL_OFFERS_REMINDER,
          replyTo: candidatesAdminMail,
          variables: {
            ..._.omitBy(user.toJSON(), _.isNil),
          },
        });
        return toEmail;
      }
    }
    return false;
  }*/
}
