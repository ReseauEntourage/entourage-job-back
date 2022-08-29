import fs from 'fs';

import { Readable } from 'stream';
import { InjectQueue } from '@nestjs/bull';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bull';
import { Cache } from 'cache-manager';
import * as _ from 'lodash';
import moment from 'moment/moment';
import { PDFDocument } from 'pdf-lib';
import * as puppeteer from 'puppeteer-core';
import { col, fn, Op, QueryTypes } from 'sequelize';
import sharp from 'sharp';
import { Ambition } from 'src/ambitions/models';
import { CloudFrontService } from 'src/aws/cloud-front.service';
import { S3Service } from 'src/aws/s3.service';
import {
  BusinessLineFilters,
  BusinessLineValue,
} from 'src/businessLines/businessLines.types';
import { buildBusinessLineForSentence } from 'src/businessLines/businessLines.utils';
import { BusinessLine } from 'src/businessLines/models';
import { ContractFilters } from 'src/contracts/contracts.types';
import { Contract } from 'src/contracts/models';
import { Experience } from 'src/experiences/models';
import { Language } from 'src/languages/models';
import { Department, DepartmentFilters } from 'src/locations/locations.types';
import { Location } from 'src/locations/models';
import { MailsService } from 'src/mails/mails.service';
import { CustomMailParams } from 'src/mails/mails.types';
import { Passion } from 'src/passions/models';
import { Jobs, Queues } from 'src/queues/queues.types';
import { Review } from 'src/reviews/models';
import { Skill } from 'src/skills/models';
import { User } from 'src/users/models';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
import { CVStatuses, CVStatusValue } from 'src/users/users.types';
import { getRelatedUser } from 'src/users/users.utils';
import {
  escapeColumnRaw,
  escapeQuery,
  getFiltersObjectsFromQueryParams,
} from 'src/utils/misc';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import { AnyToFix, FilterParams, RedisKeys } from 'src/utils/types';
import { CVConstantType, CVFilterKey, CVFilters } from './cvs.types';
import {
  cleanCV,
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
  UserAllInclude,
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
    @InjectQueue(Queues.WORK)
    private workQueue: Queue,
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

    const modelCV = await this.cvModel.create(cvData);

    const promises = [];

    if (cvData.skills) {
      promises.push(async () => {
        const skills = await Promise.all(
          cvData.skills.map((name) => {
            return this.skillModel.create({ name });
          })
        );
        await modelCV.$add('skills', skills);
      });
    }

    if (cvData.languages) {
      promises.push(async () => {
        const languages = await Promise.all(
          cvData.languages.map((name) => {
            // on trouve ou créé la donné
            return this.languageModel.create({ name });
          })
        );
        await modelCV.$add('languages', languages);
      });
    }

    if (cvData.contracts) {
      promises.push(async () => {
        const contracts = await Promise.all(
          cvData.contracts.map((name) => {
            return this.contractModel.create({ name });
          })
        );
        await modelCV.$add('contracts', contracts);
      });
    }

    if (cvData.passions) {
      promises.push(async () => {
        const passions = await Promise.all(
          cvData.passions.map((name) => {
            return this.passionModel.create({ name });
          })
        );
        await modelCV.$add('passions', passions);
      });
    }

    if (cvData.ambitions) {
      promises.push(async () => {
        const ambitions = await Promise.all(
          cvData.ambitions.map(({ name, order = -1, prefix = 'dans' }) => {
            return this.ambitionModel.create({ name, order, prefix });
          })
        );
        await modelCV.$add('ambitions', ambitions);
      });
    }

    if (cvData.businessLines) {
      promises.push(async () => {
        const businessLines = await Promise.all(
          cvData.businessLines.map(({ name, order }) => {
            return this.businessLineModel.create({ name, order });
          })
        );
        await modelCV.$add('businessLines', businessLines);
      });
    }

    if (cvData.locations) {
      promises.push(async () => {
        const locations = await Promise.all(
          cvData.locations.map((name) => {
            return this.locationModel.create({ name });
          })
        );
        await modelCV.$add('locations', locations);
      });
    }

    if (cvData.experiences) {
      promises.push(async () => {
        await Promise.all(
          cvData.experiences.map(async (experience) => {
            const modelExperience = await this.experienceModel.create({
              CVId: modelCV.id,
              description: experience.description,
              order: experience.order,
            });
            if (experience.skills) {
              const skills = await Promise.all(
                experience.skills.map((name) => {
                  return this.skillModel.create({ name });
                })
              );
              await modelExperience.$add('skills', skills);
            }
            return modelExperience;
          })
        );
      });
    }

    if (cvData.reviews) {
      promises.push(async () => {
        await Promise.all(
          cvData.reviews.map(async (review) => {
            return this.reviewModel.create({
              CVId: modelCV.id,
              text: review.text,
              status: review.status,
              name: review.name,
            });
          })
        );
      });
    }

    await Promise.all(promises);

    return this.dividedCompleteCVQuery(async (include) => {
      return this.cvModel.findByPk(modelCV.id, {
        include: [include],
      });
    }, true);
  }

  async findOne(id: string) {
    return this.cvModel.findByPk(id, {
      include: CVCompleteWithoutUserInclude,
    });
  }

  async findOneByCandidateId(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    // TODO STOP DIVIDING
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

  async findOneByUrl(url: string): Promise<CV> {
    const redisKey = RedisKeys.CV_PREFIX + url;
    const redisCV: string = await this.cacheManager.get(redisKey);

    return redisCV ? JSON.parse(redisCV) : await this.cacheCV(url);
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
        modelCVs = await this.cacheAllCVs(getPublishedCVQuery(), true);
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
      modelCVs = await this.cacheAllCVs(
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

            const filteredOtherCvs = await this.cacheAllCVs(
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
      select shares."CandidatId", (SUM(facebook) + SUM(linkedin) + SUM(twitter) + SUM(whatsapp) + SUM(other)) as totalshares
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

  async update(id: string, udpateCVDto: UpdateCVDto): Promise<CV> {
    await this.cvModel.update(udpateCVDto, {
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

    return updatedCVs.map(cleanCV);
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
    const pdfStream = Readable.from(pdfBuffer);

    await this.s3Service.upload(
      pdfStream,
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

    const response = await fetch(`${process.env.AWS_LAMBA_URL}/preview`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({
        cv: {
          ...cv,
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
        user: candidate,
        uploadedImg,
        oldImg,
      }),
    });

    const { previewUrl } = await response.json();

    return previewUrl;
  }

  async generateSearchStringFromCV(candidateId: string) {
    const limitLength = 4028;

    const cv = await this.findOneByCandidateId(candidateId);
    let searchString = [
      cv.user.candidat.firstName,
      cv.user.candidat.lastName,
      cv.businessLines
        .map((businessLine) => {
          return findConstantFromValue(businessLine.name, BusinessLineFilters)
            .label;
        })
        .join(' '),
      cv.contracts
        .map((contract) => {
          return findConstantFromValue(contract.name, ContractFilters).label;
        })
        .join(' '),
      cv.ambitions
        .map((ambition) => {
          return ambition.name;
        })
        .join(' '),
      cv.locations
        .map((location) => {
          return findConstantFromValue(location.name, DepartmentFilters).label;
        })
        .join(' '),
      cv.experiences
        .map((exp) => {
          return [exp.description, exp.skills.join(' ')].join(' ');
        })
        .join(' '),
      cv.reviews
        .map((reviews) => {
          return [reviews.text, reviews.status, reviews.name].join(' ');
        })
        .join(' '),
      cv.skills.join(' '),
      cv.languages.join(' '),
      cv.availability,
      cv.passions.join(' '),
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

  async sendMailsAfterSubmitting(user: User) {
    await this.mailsService.sendCVSubmittedMail(user);
  }

  async sendMailsAfterPublishing(candidateId: string, cv: Partial<CV>) {
    const candidate = await this.usersService.findOne(candidateId);

    await this.mailsService.sendCVPublishedMail(candidate.toJSON(), cv);

    await this.workQueue.add(
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
    await this.workQueue.add(
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
    await this.workQueue.add(
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

    await this.workQueue.add(
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
    const candidate = await this.usersService.findOne(candidateId);
    if (
      moment(candidate.createdAt).isAfter(
        moment(firstOfMarch2022, 'YYYY-MM-DD')
      )
    ) {
      const cvs = await this.findAllVersionsByCandidateId(candidateId);
      const hasSubmittedAtLeastOnce = cvs?.some(({ status }) => {
        return status === CVStatuses.Pending.value;
      });

      if (!hasSubmittedAtLeastOnce) {
        const toEmail: CustomMailParams['toEmail'] = {
          to: candidate.email,
        };
        const coach = getRelatedUser(candidate);
        if (coach) {
          toEmail.cc = coach.email;
        }

        await this.mailsService.sendCVReminderMail(
          candidate.toJSON(),
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

    return await this.mailsService.sendInterviewTrainingReminderMail(
      candidate.toJSON()
    );
  }

  async sendReminderAboutVideo(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    return this.mailsService.sendVideoReminderMail(candidate.toJSON());
  }

  async sendReminderAboutActions(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    return this.mailsService.sendActionsReminderMails(candidate);
  }

  async sendReminderAboutExternalOffers(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate.candidat.employed) {
      const toEmail: CustomMailParams['toEmail'] = {
        to: candidate.email,
      };

      /*  // TODO when opportunity
      let opportunitiesCreatedByCandidateOrCoach =
        await getExternalOpportunitiesCreatedByUserCount(candidateId);

      const coach = getRelatedUser(candidate);
      if (coach) {
        toEmail.cc = coach.email;
        opportunitiesCreatedByCandidateOrCoach +=
          await getExternalOpportunitiesCreatedByUserCount(coach.id);
      }

      if (opportunitiesCreatedByCandidateOrCoach === 0) {
        await this.mailsService.sendExternalOffersReminderMails(candidate);
        return toEmail;
      }*/
    }
    return false;
  }

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

  async cacheCV(url: string, candidatId?: string) {
    let urlToUse = url;

    if (!urlToUse && candidatId) {
      ({ url: urlToUse } = await this.userCandidatsService.findOneByCandidateId(
        candidatId
      ));
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

      await this.cacheManager.set(redisKey, JSON.stringify(cv), 0);

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
      await this.cacheManager.set(
        RedisKeys.CV_LIST,
        JSON.stringify(cleanedCVList),
        0
      );
    }

    return cleanedCVList;
  }

  async uncacheCV(url: string) {
    await this.cacheManager.del(RedisKeys.CV_PREFIX + url);
  }

  async sendCacheCV(candidateId: string) {
    await this.workQueue.add(Jobs.CACHE_CV, {
      candidateId,
    });
  }

  async sendCacheAllCVs() {
    await this.workQueue.add(Jobs.CACHE_ALL_CVS);
  }

  async sendGenerateCVSearchString(candidateId: string) {
    await this.workQueue.add(Jobs.CREATE_CV_SEARCH_STRING, {
      candidateId,
    });
  }

  async sendGenerateCVPreview(
    candidateId: string,
    oldImg: string,
    uploadedImg: string
  ) {
    await this.workQueue.add(Jobs.GENERATE_CV_PREVIEW, {
      candidateId,
      oldImg,
      uploadedImg,
    });
  }

  async sendGenerateCVPDF(candidateId: string, token: string, paths: string[]) {
    await this.workQueue.add(Jobs.GENERATE_CV_PDF, {
      candidateId,
      token,
      paths,
    });
  }

  async uploadCVImage(
    file: Express.Multer.File,
    candidateId: string,
    status: CVStatusValue
  ) {
    const { path } = file;

    let uploadedImg: string;

    try {
      const fileBuffer = await sharp(path)
        .trim()
        .jpeg({ quality: 75 })
        .toBuffer();

      const fileStream = Readable.from(fileBuffer);

      uploadedImg = await this.s3Service.upload(
        fileStream,
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
}
