import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
  Req,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminZone, FilterParams } from '../utils/types';
import {
  PayloadUser,
  RequestWithAuthorizationHeader,
} from 'src/auth/auth.types';
import { getTokenFromHeaders } from 'src/auth/auth.utils';
import { Public, UserPayload } from 'src/auth/guards';
import {
  LinkedUserGuard,
  LinkedUser,
  Roles,
  RolesGuard,
} from 'src/users/guards';
import { User } from 'src/users/models';
import { CVStatuses, UserRole, UserRoles } from 'src/users/users.types';
import { getCandidateIdFromCoachOrCandidate } from 'src/users/users.utils';
import { CVsService } from './cvs.service';
import { CVFilterKey } from './cvs.types';
import { getPDFPaths } from './cvs.utils';
import { CreateCVDto } from './dto';
import { ParseCVPipe } from './dto/parse-cv.pipe';
import * as _ from 'lodash';

// TODO change to /cvs
@Controller('cv')
export class CVsController {
  constructor(private readonly cvsService: CVsService) {}

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @UseInterceptors(FileInterceptor('profileImage', { dest: 'uploads/' }))
  @Post(':candidateId')
  async createCV(
    @Req() req: RequestWithAuthorizationHeader,
    @UserPayload() user: User,
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @UserPayload('role') role: UserRole,
    @UserPayload('zone') zone: AdminZone,
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Body('cv', new ParseCVPipe()) createCVDto: CreateCVDto,
    @Body('autoSave') autoSave: boolean,
    @UploadedFile() file: Express.Multer.File
  ) {
    switch (role) {
      case UserRoles.CANDIDAT:
        createCVDto.status = CVStatuses.Progress.value;
        break;
      case UserRoles.COACH:
        if (
          createCVDto.status !== CVStatuses.Progress.value &&
          createCVDto.status !== CVStatuses.Pending.value
        ) {
          createCVDto.status = CVStatuses.Progress.value;
        }
        break;
      case UserRoles.ADMIN:
        // on laisse la permission à l'admin de choisir le statut à enregistrer
        if (!createCVDto.status) {
          createCVDto.status = CVStatuses.Published.value;
        }
        break;
      default:
        createCVDto.status = CVStatuses.Unknown.value;
        break;
    }

    const urlImg = `images/${candidateId}.${createCVDto.status}.jpg`;

    let oldImg;

    if (!autoSave && (createCVDto.urlImg || file)) {
      oldImg = createCVDto.urlImg;
      createCVDto.urlImg = urlImg;
    }

    const createdCV = await this.cvsService.create(
      { UserId: candidateId, ...createCVDto } as CreateCVDto,
      userId
    );

    const { status } = createdCV;

    if (role === UserRoles.COACH && status === CVStatuses.Pending.value) {
      await this.cvsService.sendMailsAfterSubmitting(user);
    }

    if (!autoSave) {
      if (status === CVStatuses.Published.value) {
        await this.cvsService.sendCacheCV(candidateId);
        await this.cvsService.sendCacheAllCVs();
        await this.cvsService.sendGenerateCVSearchString(candidateId);

        const cvs = await this.cvsService.findAllVersionsByCandidateId(
          candidateId
        );

        const hasPublishedAtLeastOnce =
          cvs?.filter(({ status }) => {
            return status === CVStatuses.Published.value;
          }).length > 1;

        if (!hasPublishedAtLeastOnce) {
          await this.cvsService.sendMailsAfterPublishing(
            candidateId,
            createdCV
          );
        }
      }

      const uploadedImg = file
        ? await this.cvsService.uploadCVImage(file, candidateId, status)
        : null;

      await this.cvsService.sendGenerateCVPreview(
        candidateId,
        oldImg,
        uploadedImg
      );

      const { firstName, lastName } = createdCV.user.candidat;

      const token = getTokenFromHeaders(req);
      const paths = getPDFPaths(candidateId, `${firstName}_${lastName}`);
      await this.cvsService.sendGenerateCVPDF(candidateId, token, paths);
    }
    return createdCV;
  }

  // TODO put userId as Param and change to candidateId
  @LinkedUser('query.userId')
  @UseGuards(LinkedUserGuard)
  @Get()
  async findCVByCandidateId(
    @Query('userId', new ParseUUIDPipe()) candidateId: string
  ) {
    const cv = await this.cvsService.findOneByCandidateId(candidateId);

    if (!cv) {
      throw new NotFoundException();
    }
    return cv;
  }

  @Public()
  @Get('cards/random')
  async findAllPublishedCVs(
    @Query()
    query: {
      nb: number;
      search: string;
    } & FilterParams<CVFilterKey>
  ) {
    return this.cvsService.findAllPublished({ ...query });
  }

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Get('lastVersion/:candidateId')
  async findLastCVVersion(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string
  ) {
    const lastCvVersion = await this.cvsService.findLastVersionByCandidateId(
      candidateId
    );

    if (!lastCvVersion) {
      throw new NotFoundException();
    }
    return { lastCvVersion };
  }

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Get('pdf/:candidateId')
  async findCVInPDF(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Query('fileName') fileName: string,
    @Req()
    req: RequestWithAuthorizationHeader
  ) {
    const paths = getPDFPaths(candidateId, fileName);

    const s3Key = `${process.env.AWSS3_FILE_DIRECTORY}${paths[2]}`;

    const pdfUrl = await this.cvsService.findPDF(s3Key);

    if (!pdfUrl) {
      const createdPdfUrl = await this.cvsService.generatePDFFromCV(
        candidateId,
        getTokenFromHeaders(req),
        paths
      );
      return {
        pdfUrl: createdPdfUrl,
      };
    }

    return { pdfUrl };
  }

  @Public()
  @Get('published')
  async countTotalPublishedCVs() {
    const nbPublishedCVs = await this.cvsService.countTotalPublished();

    return { nbPublishedCVs };
  }

  @Roles(UserRoles.CANDIDAT, UserRoles.COACH)
  @UseGuards(RolesGuard)
  @Get('checkUpdate')
  async checkCVHasBeenModified(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @UserPayload() user: PayloadUser
  ) {
    const candidatId = getCandidateIdFromCoachOrCandidate(user);

    const cv = await this.cvsService.findOneByCandidateId(candidatId);

    const { lastModifiedBy } = cv;

    return {
      cvHasBeenModified: cv
        ? !!lastModifiedBy && lastModifiedBy !== userId
        : false,
    };
  }

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Roles(UserRoles.CANDIDAT, UserRoles.COACH)
  @UseGuards(RolesGuard)
  @Put('read/:candidateId')
  async setCVHasBeenRead(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @UserPayload('id', new ParseUUIDPipe()) userId: string
  ) {
    const cv = await this.cvsService.findOneByCandidateId(candidateId);

    if (!cv || _.isEmpty(cv)) {
      throw new NotFoundException();
    }

    const { id, lastModifiedBy } = cv;

    const updatedCV = await this.cvsService.update(id, {
      lastModifiedBy: lastModifiedBy !== userId ? null : lastModifiedBy,
    });

    if (!updatedCV) {
      throw new NotFoundException();
    }

    return updatedCV;
  }

  @Public()
  @Get(':url')
  async findCVByUrl(@Param('url') url: string) {
    const cv = await this.cvsService.findOneByUrl(url);

    const userCandidat = await this.cvsService.findOneUserCandidateByUrl(url);

    const exists = cv ? true : !!userCandidat;
    if (!exists) {
      throw new NotFoundException();
    }
    return {
      cv,
      exists,
    };
  }
}
