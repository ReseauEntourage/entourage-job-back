import fs from 'fs';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Cache } from 'cache-manager';
import * as _ from 'lodash';
import moment from 'moment/moment';
import fetch from 'node-fetch';
import { col, fn, Op, QueryTypes } from 'sequelize';
import sharp from 'sharp';
import { Ambition } from 'src/common/ambitions/models';
import {
  BusinessLineFilters,
  BusinessLineValue,
} from 'src/common/business-lines/business-lines.types';
import { buildBusinessLineForSentence } from 'src/common/business-lines/business-lines.utils';
import { BusinessLine } from 'src/common/business-lines/models';
import { ContractFilters } from 'src/common/contracts/contracts.types';
import { Contract } from 'src/common/contracts/models';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Language } from 'src/common/languages/models';
import {
  Department,
  DepartmentFilters,
} from 'src/common/locations/locations.types';
import { Location } from 'src/common/locations/models';
import { Passion } from 'src/common/passions/models';
import { Review } from 'src/common/reviews/models';
import { Skill } from 'src/common/skills/models';
import { S3Service } from 'src/external-services/aws/s3.service';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { User, UserCandidat } from 'src/users/models';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
import { CVStatus, CVStatuses, Gender } from 'src/users/users.types';
import {
  escapeColumnRaw,
  escapeQuery,
  getFiltersObjectsFromQueryParams,
} from 'src/utils/misc';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import { FilterParams, RedisKeys } from 'src/utils/types';
import { CVConstantType, CVFilterKey, CVFilters } from './cvs.types';
import {
  getCVOptions,
  getPublishedCVQuery,
  queryConditionCV,
} from './cvs.utils';
import { CreateCVDto, UpdateCVDto } from './dto';
import { CV, CVSearch } from './models';
import {
  CVCompleteWithAllUserInclude,
  CVCompleteWithAllUserPrivateInclude,
  CVCompleteWithoutUserInclude,
} from './models/cv.include';

@Injectable()
export class CVsService {
  constructor(
    @InjectModel(CV)
    private cvModel: typeof CV,
    @InjectModel(Skill)
    private skillModel: typeof Skill,
    @InjectModel(Language)
    private languageModel: typeof Language,
    @InjectModel(Contract)
    private contractModel: typeof Contract,
    @InjectModel(Ambition)
    private ambitionModel: typeof Ambition,
    @InjectModel(BusinessLine)
    private businessLineModel: typeof BusinessLine,
    @InjectModel(Passion)
    private passionModel: typeof Passion,
    @InjectModel(Location)
    private locationModel: typeof Location,
    @InjectModel(Experience)
    private experienceModel: typeof Experience,
    @InjectModel(Formation)
    private formationModel: typeof Formation,
    @InjectModel(Review)
    private reviewModel: typeof Review,
    @InjectModel(CVSearch)
    private cvSearchModel: typeof CVSearch,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private queuesService: QueuesService,
    private usersService: UsersService,
    private userCandidatsService: UserCandidatsService,
    private mailsService: MailsService,
    private s3Service: S3Service
  ) {}

  async create(createCVDto: CreateCVDto, userId: string) {
    // create = newerVersion => needs to increment the version
    const maxVersion = await this.findLastVersionByCandidateId(
      createCVDto.UserId
    );

    const cvData = {
      ...createCVDto,
      version: maxVersion + 1,
      lastModifiedBy: userId,
      createdAt: null as Date,
      updatedAt: null as Date,
    };

    let createdCVId: string;

    try {
      ({ id: createdCVId } = await this.cvModel.sequelize.transaction(
        async (t) => {
          const createdCV = await this.cvModel.create(cvData, {
            hooks: true,
            transaction: t,
          });

          if (cvData.skills) {
            const skills = await Promise.all(
              cvData.skills.map(({ name }) => {
                return this.skillModel.create(
                  { name },
                  {
                    hooks: true,
                    transaction: t,
                  }
                );
              })
            );
            await createdCV.$add('skills', skills, { transaction: t });
          }

          if (cvData.languages) {
            const languages = await Promise.all(
              cvData.languages.map(({ name }) => {
                return this.languageModel.create(
                  { name },
                  {
                    hooks: true,
                    transaction: t,
                  }
                );
              })
            );
            await createdCV.$add('languages', languages, { transaction: t });
          }

          if (cvData.contracts) {
            const contracts = await Promise.all(
              cvData.contracts.map(({ name }) => {
                return this.contractModel.create(
                  { name },
                  {
                    hooks: true,
                    transaction: t,
                  }
                );
              })
            );
            await createdCV.$add('contracts', contracts, { transaction: t });
          }

          if (cvData.passions) {
            const passions = await Promise.all(
              cvData.passions.map(({ name }) => {
                return this.passionModel.create(
                  { name },
                  {
                    hooks: true,
                    transaction: t,
                  }
                );
              })
            );
            await createdCV.$add('passions', passions, { transaction: t });
          }

          if (cvData.ambitions) {
            const ambitions = await Promise.all(
              cvData.ambitions.map(({ name, order = -1, prefix = 'dans' }) => {
                return this.ambitionModel.create(
                  { name, order, prefix },
                  {
                    hooks: true,
                    transaction: t,
                  }
                );
              })
            );
            await createdCV.$add('ambitions', ambitions, { transaction: t });
          }

          if (cvData.businessLines) {
            const businessLines = await Promise.all(
              cvData.businessLines.map(({ name, order = -1 }) => {
                return this.businessLineModel.create(
                  { name, order },
                  {
                    hooks: true,
                    transaction: t,
                  }
                );
              })
            );
            await createdCV.$add('businessLines', businessLines, {
              transaction: t,
            });
          }

          if (cvData.locations) {
            const locations = await Promise.all(
              cvData.locations.map(({ name, order = -1 }) => {
                return this.locationModel.create(
                  { name, order },
                  {
                    hooks: true,
                    transaction: t,
                  }
                );
              })
            );
            await createdCV.$add('locations', locations, { transaction: t });
          }

          if (cvData.experiences) {
            await Promise.all(
              cvData.experiences.map(
                async ({
                  description,
                  order,
                  skills,
                  company,
                  location,
                  title,
                  dateStart,
                  dateEnd,
                }) => {
                  const modelExperience = await this.experienceModel.create(
                    {
                      CVId: createdCV.id,
                      description: description || '',
                      order: order,
                      location: location,
                      company: company,
                      title: title,
                      dateStart: dateStart,
                      dateEnd: dateEnd,
                    },
                    {
                      hooks: true,
                      transaction: t,
                    }
                  );
                  if (skills) {
                    const experienceSkills = await Promise.all(
                      skills.map(({ name }) => {
                        return this.skillModel.create(
                          { name },
                          {
                            hooks: true,
                            transaction: t,
                          }
                        );
                      })
                    );
                    await modelExperience.$add('skills', experienceSkills, {
                      transaction: t,
                    });
                  }
                }
              )
            );
          }

          if (cvData.formations) {
            await Promise.all(
              cvData.formations.map(
                async ({
                  description,
                  skills,
                  location,
                  institution,
                  title,
                  dateStart,
                  dateEnd,
                }) => {
                  const modelFormation = await this.formationModel.create(
                    {
                      CVId: createdCV.id,
                      description: description || '',
                      institution: institution,
                      location: location,
                      title: title,
                      dateStart: dateStart,
                      dateEnd: dateEnd,
                    },
                    {
                      hooks: true,
                      transaction: t,
                    }
                  );
                  if (skills) {
                    const formationSkills = await Promise.all(
                      skills.map(({ name }) => {
                        return this.skillModel.create(
                          { name },
                          {
                            hooks: true,
                            transaction: t,
                          }
                        );
                      })
                    );
                    await modelFormation.$add('skills', formationSkills, {
                      transaction: t,
                    });
                  }
                }
              )
            );
          }

          if (cvData.reviews) {
            await Promise.all(
              cvData.reviews.map(async (review) => {
                await this.reviewModel.create(
                  {
                    CVId: createdCV.id,
                    text: review.text,
                    status: review.status,
                    name: review.name,
                  },
                  {
                    hooks: true,
                    transaction: t,
                  }
                );
              })
            );
          }
          return createdCV;
        }
      ));
    } catch (error) {
      throw error;
    }

    const cv = await this.cvModel.findByPk(createdCVId, {
      include: CVCompleteWithAllUserPrivateInclude,
    });

    return cv.toJSON();
  }

  async findOne(id: string) {
    return this.cvModel.findByPk(id, {
      include: CVCompleteWithoutUserInclude,
    });
  }

  async findOneByCandidateId(candidateId: string): Promise<CV> {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    const cv = await this.cvModel.findOne({
      include: CVCompleteWithAllUserPrivateInclude,
      where: {
        UserId: candidateId,
      },
      order: [['version', 'DESC']],
    });

    if (!cv) {
      return {} as CV;
    }
    return cv.toJSON();
  }

  async findOneByUrl(url: string): Promise<CV> {
    // check if the CV exists in the cache otherwise get the CV in the DB and cache it
    const redisKey = RedisKeys.CV_PREFIX + url;
    const redisCV: string = await this.cacheManager.get(redisKey);
    return redisCV ? JSON.parse(redisCV) : await this.findAndCacheOneByUrl(url);
  }

  async findOneUserCandidateByUrl(url: string) {
    return this.userCandidatsService.findOneByUrl(url);
  }

  async findLastVersionByCandidateId(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    const maxVersions = (await this.cvModel.findAll({
      attributes: [[fn('MAX', col('version')), 'maxVersion']],
      raw: true,
      where: {
        UserId: candidateId,
      },
    })) as { maxVersion?: number }[];

    if (!maxVersions || maxVersions.length === 0) {
      return null;
    }

    return maxVersions[0].maxVersion;
  }

  async findAllByCandidateId(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    return this.cvModel.findAll({
      where: {
        UserId: candidateId,
      },
    });
  }

  async findHasAtLeastOnceStatusByCandidateId(
    candidateId: string,
    statusToFind: CVStatus
  ) {
    const cvs = await this.cvModel.findAll({
      attributes: ['status', 'version'],
      where: {
        UserId: candidateId,
      },
    });

    return cvs.some(({ status }) => {
      return status === statusToFind;
    });
  }

  // TODO put in controller
  async findAllPublished(
    query: {
      nb: number;
      search: string;
    } & FilterParams<CVFilterKey>
  ) {
    const { nb, search, ...params } = query;

    const escapedQuery = escapeQuery(search);

    // map object
    const filtersObj = getFiltersObjectsFromQueryParams<
      CVFilterKey,
      CVConstantType
    >(params, CVFilters);

    let modelCVs: CV[];
    let hasSuggestions = false;
    const options = getCVOptions(filtersObj);

    if (!escapedQuery && Object.keys(options).length === 0) {
      const redisKey = RedisKeys.CV_LIST;
      const redisCvs: string = await this.cacheManager.get(redisKey);

      if (redisCvs) {
        modelCVs = JSON.parse(redisCvs);
      } else {
        modelCVs = await this.findAndCacheAll(getPublishedCVQuery(), true);
      }
    } else {
      const { employed, ...restOptions } = options;
      // using native query to avoid sequelize and used params
      const dbQuery = escapedQuery
        ? `
                  with publishedCVs as (${getPublishedCVQuery(employed)})
                  SELECT cvSearches."CVId" as id
                  FROM "CV_Searches" cvSearches
                           INNER JOIN publishedCVs on cvSearches."CVId" = publishedCVs."id"
                  WHERE ${escapeColumnRaw(
                    'cvSearches."searchString"'
                  )} like '%${escapedQuery}%'
        `
        : undefined;
      modelCVs = await this.findAndCacheAll(
        dbQuery,
        false,
        dbQuery ? restOptions : options
      );

      // if no results with the filters, we remove the businessLines filter
      if (modelCVs.length <= 0) {
        if (
          filtersObj &&
          filtersObj['locations']?.length > 0 &&
          filtersObj['businessLines']?.length > 0
        ) {
          const newFiltersObj: ReturnType<
            typeof getFiltersObjectsFromQueryParams
          > = {
            ...filtersObj,
            ['businessLines']: [],
          };
          const newOptions = getCVOptions(newFiltersObj);

          const { employed: newEmployed, ...newRestOptions } = newOptions;

          const filteredOtherCvs = await this.findAndCacheAll(
            dbQuery,
            false,
            dbQuery ? newRestOptions : newOptions
          );
          if (filteredOtherCvs && filteredOtherCvs.length > 0) {
            modelCVs = filteredOtherCvs;
            hasSuggestions = true;
          }
        }
      }
    }

    const totalSharesPerUser: { CandidatId: string; totalshares: number }[] =
      // using native query to sum all shares
      // gets the sum of every social network of every version of the CV for each candidate
      await this.cvModel.sequelize.query(
        `
            select shares."CandidatId",
                   (SUM(facebook) + SUM(linkedin) + SUM(twitter) + SUM(whatsapp) + SUM(other)) as totalshares
            from "Shares" shares
            GROUP BY shares."CandidatId";
        `,
        {
          type: QueryTypes.SELECT,
        }
      );

    const totalShares = totalSharesPerUser.reduce((acc, curr) => {
      return acc + curr.totalshares;
    }, 0);

    const finalCVList: (Partial<CV> & { ranking: number })[] = modelCVs.map(
      (modelCV) => {
        const cv = modelCV;
        const totalSharesForUser = totalSharesPerUser.find((shares) => {
          return shares.CandidatId === cv.user.candidat.id;
        });
        return {
          ...cv,
          ranking: totalSharesForUser
            ? totalSharesForUser.totalshares / totalShares
            : 0,
        };
      }
    );

    // group by month
    const groupedCVsByMonth = _.groupBy(finalCVList, (cv) => {
      return moment(cv.updatedAt).startOf('month').format('YYYY/MM');
    });

    // sort by share number
    const sortedGroupedCvsByMonth = _.mapValues(groupedCVsByMonth, (arr) => {
      return arr
        .sort(() => {
          return Math.random() - 0.5;
        })
        .sort((a, b) => {
          return a.ranking - b.ranking; // then order reverse by ranking
        });
    });

    // sort by date
    const sortedKeys = Object.keys(sortedGroupedCvsByMonth).sort(
      (date1, date2) => {
        return moment(date2, 'YYYY/MM').diff(moment(date1, 'YYYY/MM'));
      }
    );

    return {
      cvs: sortedKeys
        .reduce((acc, curr) => {
          return [...acc, ...sortedGroupedCvsByMonth[curr]];
        }, [])
        .slice(0, nb),
      suggestions: hasSuggestions,
    };
  }

  async countTotalPublished() {
    const cvs = await this.cvModel.sequelize.query(
      getPublishedCVQuery({ [Op.or]: [false] }),
      {
        type: QueryTypes.SELECT,
      }
    );

    return cvs.length;
  }

  async update(id: string, updateCVDto: UpdateCVDto): Promise<CV> {
    await this.cvModel.update(updateCVDto, {
      where: { id },
      individualHooks: true,
    });

    const updatedCV = await this.findOne(id);

    if (!updatedCV) {
      return null;
    }

    return updatedCV.toJSON();
  }

  async updateByCandidateId(candidateId: string, updateCVDto: UpdateCVDto) {
    await this.cvModel.update(updateCVDto, {
      where: { UserId: candidateId },
      individualHooks: true,
    });

    const updatedCVs = await this.findAllByCandidateId(candidateId);

    if (!updatedCVs || updatedCVs.length === 0) {
      return null;
    }

    return updatedCVs.map((cv) => cv.toJSON());
  }

  async removeByCandidateId(candidateId: string) {
    return this.cvModel.destroy({
      where: { UserId: candidateId },
      individualHooks: true,
      cascade: true,
    });
  }

  getPDFPageUrl(candidateId: string) {
    return `${process.env.FRONT_URL}/cv/pdf/${candidateId}`;
  }

  async findPDF(key: string) {
    try {
      const pdfExists = await this.s3Service.getHead(key);

      if (pdfExists) {
        return this.s3Service.getSignedUrl(
          key,
          'application/pdf',
          'attachment'
        );
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async generatePDFFromCV(
    candidateId: string,
    token: string,
    fileName: string
  ) {
    const response = await fetch(`${process.env.CV_PDF_GENERATION_AWS_URL}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({
        candidateId,
        token,
        fileName,
      }),
    });

    const responseJSON = await response.json();

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`${response.status}, ${responseJSON.message}`);
    }

    const { pdfUrl } = responseJSON as { pdfUrl: string };

    return pdfUrl;
  }

  async generatePreviewFromCV(
    candidateId: string,
    uploadedImg: string,
    oldImg: string
  ) {
    const cv = await this.findOneByCandidateId(candidateId);
    const candidate = await this.usersService.findOne(candidateId);

    const isNewCareerPath = cv.businessLines?.every(({ order }) => {
      return order > -1;
    });

    // TODO Update Lambda to use new association objects with name
    const response = await fetch(`${process.env.AWS_LAMBDA_URL}/preview`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({
        cv: {
          UserId: cv.UserId,
          status: cv.status,
          urlImg: cv.urlImg,
          catchphrase: cv.catchphrase,
          skills: cv.skills.map(({ name }) => name),
          locations: cv.locations.map(({ name }) => name),
          ambitions: isNewCareerPath
            ? _.uniqWith(cv.businessLines, (a, b) => {
                return a.name === b.name;
              }).map((businessLine) => {
                return {
                  ...businessLine,
                  name: buildBusinessLineForSentence(
                    findConstantFromValue(
                      businessLine.name,
                      BusinessLineFilters
                    )
                  ),
                };
              })
            : cv.ambitions,
        },
        user: candidate.toJSON(),
        uploadedImg,
        oldImg,
      }),
    });

    const responseJSON = await response.json();

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`${response.status}, ${responseJSON.message}`);
    }

    const { previewUrl } = responseJSON as { previewUrl: string };

    return previewUrl;
  }

  async generateSearchStringFromCV(candidateId: string) {
    const limitLength = 4028;

    const cv = await this.findOneByCandidateId(candidateId);

    if (!cv || _.isEmpty(cv)) {
      return;
    }
    let searchString = [
      cv.user.candidat.firstName,
      cv.user.candidat.lastName,
      cv.businessLines
        .map(({ name }) => {
          return findConstantFromValue(name, BusinessLineFilters).label;
        })
        .join(' '),
      cv.contracts
        .map(({ name }) => {
          return findConstantFromValue(name, ContractFilters).label;
        })
        .join(' '),
      cv.ambitions
        .map(({ name }) => {
          return name;
        })
        .join(' '),
      cv.locations
        .map(({ name }) => {
          return findConstantFromValue(name, DepartmentFilters).label;
        })
        .join(' '),
      cv.experiences
        .map(({ description, skills }) => {
          return [description, skills.map(({ name }) => name).join(' ')].join(
            ' '
          );
        })
        .join(' '),
      cv.formations
        .map(({ description, skills }) => {
          return [description, skills.map(({ name }) => name).join(' ')].join(
            ' '
          );
        })
        .join(' '),
      cv.reviews
        .map(({ text, status, name }) => {
          return [text, status, name].join(' ');
        })
        .join(' '),
      cv.skills
        .map(({ name }) => {
          return name;
        })
        .join(' '),
      cv.languages
        .map(({ name }) => {
          return name;
        })
        .join(' '),
      cv.availability,
      cv.passions
        .map(({ name }) => {
          return name;
        })
        .join(' '),
      cv.transport,
      cv.story,
      cv.catchphrase,
    ]
      .join(' ')
      .replace(/\s\s+/g, ' ')
      .trim();

    if (searchString.length > limitLength) {
      searchString = searchString.substring(0, limitLength);
    }

    await this.cvSearchModel.create({
      CVId: cv.id,
      searchString,
    });
    return searchString;
  }

  async sendMailsAfterSubmitting(
    user: User,
    candidateId: string,
    cv: Partial<CV>
  ) {
    await this.mailsService.sendCVSubmittedMail(user, candidateId, cv);
  }

  async sendMailsAfterPublishing(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    // notify candidate that his CV has been published
    await this.mailsService.sendCVPublishedMail(candidate.toJSON());

    await this.queuesService.addToWorkQueue(
      Jobs.REMINDER_INTERVIEW_TRAINING,
      {
        candidateId,
      },
      {
        delay:
          (process.env.VIDEO_REMINDER_DELAY
            ? parseFloat(process.env.VIDEO_REMINDER_DELAY)
            : 7) *
          3600000 *
          24,
      }
    );
    await this.queuesService.addToWorkQueue(
      Jobs.REMINDER_ACTIONS,
      {
        candidateId,
      },
      {
        delay:
          (process.env.ACTIONS_REMINDER_DELAY
            ? parseFloat(process.env.ACTIONS_REMINDER_DELAY)
            : 42) *
          3600000 *
          24,
      }
    );
  }

  async sendReminderAboutCV(candidateId: string, is20Days = false) {
    const firstOfMarch2022 = '2022-03-01'; // certainly to avoid backfill errors => outdated
    const candidate = (await this.usersService.findOne(candidateId)).toJSON();
    if (
      moment(candidate.createdAt).isAfter(
        moment(firstOfMarch2022, 'YYYY-MM-DD')
      )
    ) {
      const hasSubmittedAtLeastOnce =
        await this.findHasAtLeastOnceStatusByCandidateId(
          candidateId,
          CVStatuses.PENDING.value
        );

      if (!hasSubmittedAtLeastOnce) {
        return this.mailsService.sendCVReminderMail(candidate, is20Days);
      }
    }
    return false;
  }

  async sendReminderAboutInterviewTraining(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    return this.mailsService.sendInterviewTrainingReminderMail(
      candidate.toJSON()
    );
  }

  async sendReminderAboutVideo(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    return this.mailsService.sendVideoReminderMail(candidate.toJSON());
  }

  async sendReminderAboutActions(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    return this.mailsService.sendActionsReminderMails(candidate.toJSON());
  }

  async findAndCacheOneByUrl(url?: string, candidateId?: string) {
    let urlToUse = url;

    if (!urlToUse && candidateId) {
      ({ url: urlToUse } = await this.userCandidatsService.findOneByCandidateId(
        candidateId
      ));
    }

    const redisKey = RedisKeys.CV_PREFIX + urlToUse;

    const query = queryConditionCV('url', urlToUse.replace(/'/g, "''"));

    const cvs: CV[] = await this.cvModel.sequelize.query(query, {
      type: QueryTypes.SELECT,
    });

    if (cvs && cvs.length > 0) {
      const cv = await this.cvModel.findByPk(cvs[0].id, {
        include: CVCompleteWithAllUserInclude,
      });

      await this.cacheManager.set(redisKey, JSON.stringify(cv.toJSON()), {
        ttl: 0,
      });

      return cv.toJSON();
    }

    return null;
  }

  async findAndCacheAll(
    dbQuery?: string,
    cache = false,
    options: {
      employed?: { [Op.or]: boolean[] };
      locations?: { [Op.or]: Department[] };
      businessLines?: { [Op.or]: BusinessLineValue[] };
      gender?: { [Op.or]: Gender[] };
    } = {}
  ) {
    const { employed, locations, businessLines, gender } = options;

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
        {
          model: Ambition,
          as: 'ambitions',
          through: { attributes: [] },
          attributes: ['name', 'order', 'prefix'],
        },
        {
          model: Skill,
          as: 'skills',
          through: { attributes: [] },
          attributes: ['name'],
        },
        {
          model: BusinessLine,
          as: 'businessLines',
          through: { attributes: [] },
          attributes: ['name', 'order'],
          where: businessLines
            ? {
                name: businessLines,
              }
            : undefined,
        },
        {
          model: Location,
          as: 'locations',
          through: { attributes: [] },
          attributes: ['name', 'order'],
          order: [['locations.order', 'ASC']],
          where: locations
            ? {
                name: locations,
              }
            : undefined,
        },
        {
          model: UserCandidat,
          as: 'user',
          attributes: ['employed', 'hidden', 'url', 'endOfContract'],
          required: true,
          include: [
            {
              model: User,
              as: 'coach',
              attributes: ['id', 'firstName', 'lastName', 'gender'],
            },
            {
              model: User,
              as: 'candidat',
              attributes: ['id', 'firstName', 'lastName', 'gender'],
              where: gender ? { gender } : undefined,
            },
          ],
        },
      ],
    });

    const cleanedCVList = cvList.map((cv) => cv.toJSON());

    if (cache) {
      await this.cacheManager.set(
        RedisKeys.CV_LIST,
        JSON.stringify(cleanedCVList),
        { ttl: 0 }
      );
    }

    return cleanedCVList;
  }

  async uncacheCV(url: string) {
    await this.cacheManager.del(RedisKeys.CV_PREFIX + url);
  }

  async sendCacheCV(candidateId: string) {
    await this.queuesService.addToWorkQueue(Jobs.CACHE_CV, {
      candidateId,
    });
  }

  async sendCacheAllCVs() {
    await this.queuesService.addToWorkQueue(Jobs.CACHE_ALL_CVS, {});
  }

  async sendGenerateCVSearchString(candidateId: string) {
    await this.queuesService.addToWorkQueue(Jobs.CREATE_CV_SEARCH_STRING, {
      candidateId,
    });
  }

  async sendGenerateCVPDF(
    candidateId: string,
    token: string,
    fileName: string
  ) {
    await this.queuesService.addToWorkQueue(Jobs.GENERATE_CV_PDF, {
      candidateId,
      token,
      fileName,
    });
  }

  async uploadCVImage(
    file: Express.Multer.File,
    candidateId: string,
    status: CVStatus
  ) {
    const { path } = file;

    let uploadedImg: string;

    try {
      const fileBuffer = await sharp(path).jpeg({ quality: 75 }).toBuffer();

      uploadedImg = await this.s3Service.upload(
        fileBuffer,
        'image/jpeg',
        `${candidateId}.${status}.jpg`
      );
    } catch (error) {
      uploadedImg = null;
    } finally {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path); // remove image locally after upload to S3
      }
    }
    return uploadedImg;
  }
}
