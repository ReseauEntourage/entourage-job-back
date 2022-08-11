import { InjectQueue } from '@nestjs/bull';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bull';
import { Cache } from 'cache-manager';
import moment from 'moment/moment';
import { col, fn, Op, QueryTypes } from 'sequelize';
import { BusinessLineValue } from 'src/businessLines/businessLines.types';
import { BusinessLine } from 'src/businessLines/models';
import { Department } from 'src/locations/locations.types';
import { Location } from 'src/locations/models';
import { CustomMailParams } from 'src/mails/mailjet.service';
import { MailsService } from 'src/mails/mails.service';
import { Jobs, Queues } from 'src/queues/queues.types';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
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
import fs from 'fs';
import { S3Service } from 'src/aws/s3.service';
import { CloudFrontService } from '../aws/cloud-front.service';
import * as puppeteer from 'puppeteer-core';
import { PDFDocument } from 'pdf-lib';

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
    private mailsService: MailsService,
    private s3Service: S3Service,
    private cloudFrontService: CloudFrontService
  ) {}

  async findOne(id: string) {
    return this.cvModel.findByPk(id, {
      include: CVCompleteWithoutUserInclude,
    });
  }

  async findOneByCandidateId(candidateId: string) {
    const user = await this.usersService.findOne(candidateId);

    if (!user) {
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
    const user = await this.usersService.findOne(candidateId);

    if (!user) {
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
    const user = await this.usersService.findOne(candidateId);

    if (!user) {
      return null;
    }

    return this.cvModel.findAll({
      where: {
        UserId: candidateId,
      },
    });
  }

  async findAllVersions(candidateId: string): Promise<CV[]> {
    return this.cvModel.findAll({
      attributes: ['status', 'version'],
      where: {
        UserId: candidateId,
      },
    });
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
      executablePath: process.env.CHROME_PATH,
    });
    const page = await browser.newPage();

    const options = {
      content: '@page { size: A4 portrait; margin: 0; }',
    };

    // Fix because can't create page break
    await page.goto(
      `${process.env.FRONT_URL}/cv/pdf/${candidateId}?token=${token}&page=0`,
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
      `${process.env.FRONT_URL}/cv/pdf/${candidateId}?token=${token}&page=1`,
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

  async sendReminderAboutCV(candidateId: string, is20Days = false) {
    const firstOfMarch2022 = '2022-03-01';
    const user = await this.usersService.findOne(candidateId);
    if (
      moment(user.createdAt).isAfter(moment(firstOfMarch2022, 'YYYY-MM-DD'))
    ) {
      const cvs = await this.findAllVersions(candidateId);
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
        /* {
          models: models.Ambition,
          as: 'ambitions',
          through: { attributes: [] },
          attributes: ['name', 'order', 'prefix'],
        },
        {
          models: models.Skill,
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
      candidatId: candidateId,
    });
  }

  async sendCacheAllCVs() {
    await this.workQueue.add(Jobs.CACHE_ALL_CVS);
  }
}
