import { CACHE_MANAGER, forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Cache } from 'cache-manager';
import _ from 'lodash';
import moment from 'moment/moment';
import { Op, QueryTypes, WhereOptions } from 'sequelize';
import { BusinessLine, BusinessLineValue } from '../businessLines';
import { Department, Location } from '../locations';
import { CustomMailParams, MailjetService } from 'src/mails';
import { MailjetTemplate, MailjetTemplates } from 'src/mails/mails.service';
import {
  getPublishedCVQuery,
  getRelatedUser,
  User,
  UserAttributes,
  UserCandidatsService,
  UsersService,
} from 'src/users';
import { getAdminMailsFromZone } from 'src/utils/misc';

import { AnyToFix, RedisKeys } from 'src/utils/types';
import { CVStatuses } from './cvs.types';
import { cleanCV, queryConditionCV } from './cvs.utils';
import { CV } from './models';
import {
  CVCompleteWithAllUserInclude,
  CVCompleteWithAllUserPrivateInclude,
  CVCompleteWithoutUserInclude,
  UserAllInclude,
} from './models/cv.include';

@Injectable()
export class CVsService {
  constructor(
    @InjectModel(CV)
    private cvModel: typeof CV,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    // TODO fix forwardRef
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    // TODO fix forwardRef
    @Inject(forwardRef(() => UserCandidatsService))
    private userCandidatsService: UserCandidatsService,
    private mailjetService: MailjetService
  ) {}

  async findOne(id: string) {
    return this.cvModel.findByPk(id, {
      include: CVCompleteWithoutUserInclude,
    });
  }

  async findOneByCandidateId(candidateId: string) {
    const user = await this.usersService.findOne(candidateId);

    if (user) {
      return this.dividedCompleteCVQuery(async (include) => {
        return this.cvModel.findOne({
          include: [include],
          where: {
            UserId: candidateId,
          },
          order: [['version', 'DESC']],
        });
      }, true);
    }

    return null;
  }

  async findAllUserCVsVersions(candidateId: string): Promise<CV[]> {
    return this.cvModel.findAll({
      attributes: ['status', 'version'],
      where: {
        UserId: candidateId,
      },
    });
  }

  async removeByCandidateId(id: string) {
    return this.cvModel.destroy({
      where: { UserId: id },
      individualHooks: true,
    });
  }

  async sendReminderAboutCV(candidateId: string, is20Days = false) {
    const firstOfMarch2022 = '2022-03-01';
    const user = await this.usersService.findOne(candidateId);
    if (
      moment(user.createdAt).isAfter(moment(firstOfMarch2022, 'YYYY-MM-DD'))
    ) {
      const cvs = await this.findAllUserCVsVersions(candidateId);
      const hasSubmittedAtLeastOnce = cvs?.some(({ status }) => {
        return status === CVStatuses.Pending.value;
      });

      if (!hasSubmittedAtLeastOnce) {
        const toEmail: CustomMailParams['toEmail'] = {
          to: user.email,
        };
        const coach = getRelatedUser(user);
        if (coach) {
          toEmail.cc = coach.email;
        }

        await this.sendCvReminderMail(user.toJSON(), is20Days, toEmail);
        return toEmail;
      }
    }
    return false;
  }

  async sendCvReminderMail(
    candidate: User,
    is20Days = false,
    toEmail: CustomMailParams['toEmail']
  ) {
    const { candidatesAdminMail } = getAdminMailsFromZone(candidate.zone);

    await this.mailjetService.sendMail({
      toEmail,
      templateId: is20Days
        ? MailjetTemplates.CV_REMINDER_20
        : MailjetTemplates.CV_REMINDER_10,
      replyTo: candidatesAdminMail,
      variables: {
        ..._.omitBy(candidate, _.isNil),
      },
    });
  }

  // TODO send mails through MailsService
  async sendReminderIfNotEmployed(
    candidateId: string,
    templateId: MailjetTemplate
  ) {
    const user = await this.usersService.findOne(candidateId);
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

  /*
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
  }
  */
  async dividedCompleteCVQuery(
    query: (include: AnyToFix) => Promise<CV>,
    privateUser = false
  ) {
    const completeIncludes = privateUser
      ? CVCompleteWithAllUserPrivateInclude
      : CVCompleteWithAllUserInclude;

    const results = await Promise.all(
      completeIncludes.map(async (include) => {
        return query(include);
      })
    );

    return results.reduce((acc, curr) => {
      const cleanedCurr = cleanCV(curr);
      return {
        ...acc,
        ...cleanedCurr,
      };
    }, {} as CV);
  }

  async cacheCV(url: string, candidatId: string) {
    let urlToUse = url;

    if (!urlToUse && candidatId) {
      const userCandidat = await this.userCandidatsService.findOneByCandidateId(
        candidatId
      );
      urlToUse = userCandidat.url;
    }

    const redisKey = RedisKeys.CV_PREFIX + urlToUse;

    const cvs: CV[] = await this.cvModel.sequelize.query(
      queryConditionCV('url', urlToUse.replace("'", "''")),
      {
        type: QueryTypes.SELECT,
      }
    );

    if (cvs && cvs.length > 0) {
      const cv = await this.dividedCompleteCVQuery(
        async (include: AnyToFix) => {
          return this.cvModel.findByPk(cvs[0].id, {
            include: [include],
          });
        }
      );

      // TODO fix ttl
      await this.cacheManager.set(redisKey, JSON.stringify(cv));

      return cv;
    }
    return null;
  }

  async cacheAllCVs(
    dbQuery?: string,
    cache = false,
    options: {
      employed?: { [Op.or]: boolean[] };
      locations?: { [Op.or]: Department[] };
      businessLines?: { [Op.or]: BusinessLineValue[] };
    } = {}
  ) {
    const { employed, ...restOptions } = options;

    const cvs: CV[] = await this.cvModel.sequelize.query(
      dbQuery || getPublishedCVQuery(employed),
      {
        type: QueryTypes.SELECT,
      }
    );

    const cvList = await this.cvModel.findAll({
      where: {
        id: cvs.map((cv) => {
          return cv.id;
        }),
      },
      attributes: ['id', 'catchphrase', 'urlImg', 'updatedAt'],
      include: [
        /* {
          model: models.Ambition,
          as: 'ambitions',
          through: { attributes: [] },
          attributes: ['name', 'order', 'prefix'],
        },
        {
          model: models.Skill,
          as: 'skills',
          through: { attributes: [] },
          attributes: ['name'],
        },*/
        {
          model: BusinessLine,
          as: 'businessLines',
          through: { attributes: [] },
          attributes: ['name', 'order'],
          where: restOptions.businessLines
            ? {
                name: restOptions.businessLines,
              }
            : undefined,
        },
        {
          model: Location,
          as: 'locations',
          through: { attributes: [] },
          attributes: ['name'],
          where: restOptions.locations
            ? {
                name: restOptions.locations,
              }
            : undefined,
        },
        UserAllInclude,
      ],
    });

    const cleanedCVList = cvList.map(cleanCV);

    if (cache) {
      // TODO add TTL
      await this.cacheManager.set(
        RedisKeys.CV_LIST,
        JSON.stringify(cleanedCVList)
      );
    }

    return cleanedCVList;
  }
}
