import fs from 'fs';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Cache } from 'cache-manager';
import * as _ from 'lodash';
import moment from 'moment/moment';
import fetch from 'node-fetch';
import { PDFDocument } from 'pdf-lib';
import * as puppeteer from 'puppeteer-core';
import { col, fn, Op, QueryTypes } from 'sequelize';
import sharp from 'sharp';
import { Ambition } from 'src/common/ambitions/models';
import {
  BusinessLineFilters,
  BusinessLineValue,
} from 'src/common/businessLines/businessLines.types';
import { buildBusinessLineForSentence } from 'src/common/businessLines/businessLines.utils';
import { BusinessLine } from 'src/common/businessLines/models';
import { ContractFilters } from 'src/common/contracts/contracts.types';
import { Contract } from 'src/common/contracts/models';
import { Experience } from 'src/common/experiences/models';
import { Language } from 'src/common/languages/models';
import {
  Department,
  DepartmentFilters,
} from 'src/common/locations/locations.types';
import { Location } from 'src/common/locations/models';
import { Passion } from 'src/common/passions/models';
import { Review } from 'src/common/reviews/models';
import { Skill } from 'src/common/skills/models';
import { CloudFrontService } from 'src/external-services/aws/cloud-front.service';
import { S3Service } from 'src/external-services/aws/s3.service';
import { CustomMailParams } from 'src/external-services/mailjet/mailjet.types';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { User, UserCandidat } from 'src/users/models';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
import { CVStatus, CVStatuses, Gender, UserRoles } from 'src/users/users.types';
import { getCoachFromCandidate } from 'src/users/users.utils';
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
    @InjectModel(Review)
    private reviewModel: typeof Review,
    @InjectModel(CVSearch)
    private cvSearchModel: typeof CVSearch,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private queuesService: QueuesService,
    private usersService: UsersService,
    private userCandidatsService: UserCandidatsService,
    private mailsService: MailsService,
    private s3Service: S3Service,
    private cloudFrontService: CloudFrontService
  ) {}

  async create(createCVDto: CreateCVDto, userId: string) {
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

    const t = await this.cvModel.sequelize.transaction();

    try {
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
          cvData.businessLines.map(({ name, order }) => {
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
          cvData.locations.map(({ name }) => {
            return this.locationModel.create(
              { name },
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
          cvData.experiences.map(async (experience) => {
            const modelExperience = await this.experienceModel.create(
              {
                CVId: createdCV.id,
                description: experience.description || '',
                order: experience.order,
              },
              {
                hooks: true,
                transaction: t,
              }
            );
            if (experience.skills) {
              const skills = await Promise.all(
                experience.skills.map(({ name }) => {
                  return this.skillModel.create(
                    { name },
                    {
                      hooks: true,
                      transaction: t,
                    }
                  );
                })
              );
              await modelExperience.$add('skills', skills, { transaction: t });
            }
          })
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

      await t.commit();

      const cv = await this.cvModel.findByPk(createdCV.id, {
        include: CVCompleteWithAllUserPrivateInclude,
      });

      return cv.toJSON();
    } catch (error) {
      await t.rollback();
      throw error;
    }
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

  async findAllVersionsByCandidateId(candidateId: string): Promise<CV[]> {
    return this.cvModel.findAll({
      attributes: ['status', 'version'],
      where: {
        UserId: candidateId,
      },
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

      if (modelCVs.length <= 0) {
        if (
          filtersObj &&
          filtersObj[CVFilters[1].key] &&
          filtersObj[CVFilters[1].key].length > 0
        ) {
          if (
            filtersObj[CVFilters[2].key] &&
            filtersObj[CVFilters[2].key].length > 0
          ) {
            const newFiltersObj: ReturnType<
              typeof getFiltersObjectsFromQueryParams
            > = {
              ...filtersObj,
              [CVFilters[2].key]: [],
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
    }

    const totalSharesPerUser: { CandidatId: string; totalshares: number }[] =
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

    const groupedCVsByMonth = _.groupBy(finalCVList, (cv) => {
      return moment(cv.updatedAt).startOf('month').format('YYYY/MM');
    });

    const sortedGroupedCvsByMonth = _.mapValues(groupedCVsByMonth, (arr) => {
      return arr
        .sort(() => {
          return Math.random() - 0.5;
        })
        .sort((a, b) => {
          return a.ranking - b.ranking; // then order reverse by ranking
        });
    });

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
    });
  }

  getPDFPageUrl(candidateId: string) {
    return `${process.env.FRONT_URL}/cv/pdf/${candidateId}`;
  }

  async findPDF(key: string) {
    try {
      const pdfExists = await this.s3Service.getHead(key);

      if (pdfExists) {
        return this.s3Service.getSignedUrl(key);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async generatePDFFromCV(candidateId: string, token: string, paths: string[]) {
    const s3Key = `${process.env.AWSS3_FILE_DIRECTORY}${paths[2]}`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
      executablePath:
        process.env.PUPPETEER_EXEC_PATH || process.env.CHROME_PATH,
    });
    const page = await browser.newPage();

    const options = {
      content: '@page { size: A4 portrait; margin: 0; }',
    };

    // Fix because can't create page break
    await page.goto(
      `${this.getPDFPageUrl(candidateId)}?token=${token}&page=0`,
      { waitUntil: 'networkidle2' }
    );

    await page.addStyleTag(options);
    await page.emulateMediaType('screen');
    await page.pdf({
      path: paths[0],
      preferCSSPageSize: true,
      printBackground: true,
    });

    await page.goto(
      `${this.getPDFPageUrl(candidateId)}?token=${token}&page=1`,
      { waitUntil: 'networkidle2' }
    );

    await page.addStyleTag(options);
    await page.emulateMediaType('screen');
    await page.pdf({
      path: paths[1],
      preferCSSPageSize: true,
      printBackground: true,
    });

    await page.close();

    await browser.close();

    const mergedPdf = await PDFDocument.create();

    const pdfA = await PDFDocument.load(fs.readFileSync(paths[0]));
    const pdfB = await PDFDocument.load(fs.readFileSync(paths[1]));

    const copiedPagesA = await mergedPdf.copyPages(pdfA, pdfA.getPageIndices());
    copiedPagesA.forEach((pdfPage) => {
      return mergedPdf.addPage(pdfPage);
    });

    const copiedPagesB = await mergedPdf.copyPages(pdfB, pdfB.getPageIndices());
    copiedPagesB.forEach((pdfPage) => {
      return mergedPdf.addPage(pdfPage);
    });

    const mergedPdfFile = await mergedPdf.save();

    const pdfBuffer = Buffer.from(mergedPdfFile);

    await this.s3Service.upload(
      pdfBuffer,
      'application/pdf',
      `${paths[2]}`,
      true
    );

    if (fs.existsSync(paths[0])) {
      fs.unlinkSync(paths[0]);
    }
    if (fs.existsSync(paths[1])) {
      fs.unlinkSync(paths[1]);
    }
    if (fs.existsSync(paths[2])) {
      fs.unlinkSync(paths[2]);
    }

    await this.cloudFrontService.invalidateCache(['/' + s3Key]);

    return this.s3Service.getSignedUrl(s3Key);
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
    coach: User,
    candidateId: string,
    cv: Partial<CV>
  ) {
    await this.mailsService.sendCVSubmittedMail(coach, candidateId, cv);
  }

  async sendMailsAfterPublishing(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

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
      Jobs.REMINDER_VIDEO,
      {
        candidateId,
      },
      {
        delay:
          (process.env.VIDEO_REMINDER_DELAY
            ? parseFloat(process.env.VIDEO_REMINDER_DELAY)
            : 21) *
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

    await this.queuesService.addToWorkQueue(
      Jobs.REMINDER_EXTERNAL_OFFERS,
      {
        candidateId,
      },
      {
        delay:
          (process.env.EXTERNAL_OFFERS_REMINDER_DELAY
            ? parseFloat(process.env.EXTERNAL_OFFERS_REMINDER_DELAY)
            : 60) *
          3600000 *
          24,
      }
    );
  }

  async sendReminderAboutCV(candidateId: string, is20Days = false) {
    const firstOfMarch2022 = '2022-03-01';
    const candidate = (await this.usersService.findOne(candidateId)).toJSON();
    if (
      moment(candidate.createdAt).isAfter(
        moment(firstOfMarch2022, 'YYYY-MM-DD')
      )
    ) {
      const cvs = await this.findAllVersionsByCandidateId(candidateId);
      const hasSubmittedAtLeastOnce = cvs?.some(({ status }) => {
        return status === CVStatuses.PENDING.value;
      });

      if (!hasSubmittedAtLeastOnce) {
        const toEmail: CustomMailParams['toEmail'] = {
          to: candidate.email,
        };
        const coach = getCoachFromCandidate(candidate);
        if (coach && coach.role !== UserRoles.COACH_EXTERNAL) {
          toEmail.cc = coach.email;
        }

        await this.mailsService.sendCVReminderMail(
          candidate,
          is20Days,
          toEmail
        );
        return toEmail;
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
          attributes: ['name'],
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

  async sendGenerateCVPreview(
    candidateId: string,
    oldImg: string,
    uploadedImg: string
  ) {
    await this.queuesService.addToWorkQueue(Jobs.GENERATE_CV_PREVIEW, {
      candidateId,
      oldImg,
      uploadedImg,
    });
  }

  async sendGenerateCVPDF(candidateId: string, token: string, paths: string[]) {
    await this.queuesService.addToWorkQueue(Jobs.GENERATE_CV_PDF, {
      candidateId,
      token,
      paths,
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
      const fileBuffer = await sharp(path)
        .trim()
        .jpeg({ quality: 75 })
        .toBuffer();

      uploadedImg = await this.s3Service.upload(
        fileBuffer,
        'image/jpeg',
        `${candidateId}.${status}.jpg`
      );

      /*
        TO KEEP If ever we want to pre-resize the preview background image

        const previewBuffer = await sharp(fileBuffer)
          .trim()
          .resize(imageWidth, imageHeight, {
            fit: 'cover',
          })
          .jpeg({quality: 75})
          .toBuffer();

        await S3.upload(
          previewBuffer,
          'image/jpeg',
          `${createCVDto.UserId}.${createCVDto.status}.small.jpg`
        );
      */
    } catch (error) {
      uploadedImg = null;
    } finally {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path); // remove image locally after upload to S3
      }
    }
    return uploadedImg;
  }

  async sendOffersAfterPublishing(
    candidateId: string,
    locations: Location[],
    businessLines: BusinessLine[]
  ) {
    await this.queuesService.addToWorkQueue(
      Jobs.SEND_OFFERS_EMAIL_AFTER_CV_PUBLISH,
      {
        candidateId,
        locations,
        businessLines,
      },
      {
        delay:
          (process.env.SEND_OFFERS_EMAIL_AFTER_CV_PUBLISH_DELAY
            ? parseFloat(process.env.SEND_OFFERS_EMAIL_AFTER_CV_PUBLISH_DELAY)
            : 60) *
          3600000 *
          24,
      }
    );
  }
}
