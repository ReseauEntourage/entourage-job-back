import { InjectQueue } from '@nestjs/bull';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bull';
import { Cache } from 'cache-manager';
import moment from 'moment/moment';
import { Op, QueryTypes } from 'sequelize';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
import { BusinessLineValue } from 'src/businessLines/businessLines.types';
import { BusinessLine } from 'src/businessLines/models';
import { Department } from 'src/locations/locations.types';
import { Location } from 'src/locations/models';
import { CustomMailParams } from 'src/mails/mailjet.service';
import { MailsService } from 'src/mails/mails.service';
import { Jobs, Queues } from 'src/queues/queues.types';
import { getPublishedCVQuery, getRelatedUser } from 'src/users/users.utils';
import { AnyToFix, RedisKeys } from 'src/utils/types';
import { CVStatuses } from './cvs.types';
import { cleanCV, queryConditionCV } from './cvs.utils';
import { UpdateCVDto } from './dto';
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
    @InjectQueue(Queues.WORK)
    private workQueue: Queue,
    private usersService: UsersService,
    private userCandidatsService: UserCandidatsService,
    private mailsService: MailsService
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

  async findAllByCandidateId(candidateId: string) {
    const user = await this.usersService.findOne(candidateId);

    if (user) {
      return this.cvModel.findAll({
        where: {
          UserId: candidateId,
        },
      });
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

  async updateByCandidateId(candidateId: string, updateCVDto: UpdateCVDto) {
    const [updateCount] = await this.cvModel.update(updateCVDto, {
      where: { UserId: candidateId },
      individualHooks: true,
    });

    if (updateCount === 0) {
      return null;
    }

    const updatedCVs = await this.findAllByCandidateId(candidateId);

    return updatedCVs.map(cleanCV);
  }

  async removeByCandidateId(candidateId: string) {
    return this.cvModel.destroy({
      where: { UserId: candidateId },
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

        await this.mailsService.sendCVReminderMail(
          user.toJSON(),
          is20Days,
          toEmail
        );
        return toEmail;
      }
    }
    return false;
  }

  async sendReminderAboutInterviewTraining(candidateId: string) {
    const user = await this.usersService.findOne(candidateId);

    await this.mailsService.sendInterviewTrainingReminderMail(user.toJSON());
  }

  async sendReminderAboutVideo(candidateId: string) {
    const user = await this.usersService.findOne(candidateId);

    return this.mailsService.sendVideoReminderMail(user.toJSON());
  }

  async sendReminderAboutActions(candidateId: string) {
    const user = await this.usersService.findOne(candidateId);

    return this.mailsService.sendActionsReminderMails(user);
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
    }, {} as Partial<CV>);
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

  async uncacheCV(url: string) {
    await this.cacheManager.del(RedisKeys.CV_PREFIX + url);
  }

  async sendCacheCV(candidateId: string) {
    await this.workQueue.add(Jobs.CACHE_CV, {
      candidatId: candidateId,
    });
  }

  async sendCacheAllCVs() {
    await this.workQueue.add(Jobs.CACHE_ALL_CVS);
  }
}
