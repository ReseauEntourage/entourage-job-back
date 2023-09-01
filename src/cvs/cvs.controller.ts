import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as _ from 'lodash';
import {
  PayloadUser,
  RequestWithAuthorizationHeader,
} from 'src/auth/auth.types';
import { getTokenFromHeaders } from 'src/auth/auth.utils';
import { Public, UserPayload } from 'src/auth/guards';
import {
  LinkedUser,
  LinkedUserGuard,
  UserPermissions,
  UserPermissionsGuard,
} from 'src/users/guards';
import { User } from 'src/users/models';
import {
  CandidateUserRoles,
  CoachUserRoles,
  CVStatuses,
  Permissions,
  UserRole,
  UserRoles,
} from 'src/users/users.types';
import { isRoleIncluded } from 'src/users/users.utils';
import { AdminZone, FilterParams } from 'src/utils/types';
import { CVsService } from './cvs.service';
import { CVFilterKey } from './cvs.types';
import { getPDFPaths } from './cvs.utils';
import { CreateCVDto } from './dto';
import { ParseCVPipe } from './dto/parse-cv.pipe';

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
    @UserPayload() user: PayloadUser,
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @UserPayload('role') role: UserRole,
    @UserPayload('zone') zone: AdminZone,
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Body('cv', new ParseCVPipe()) createCVDto: CreateCVDto,
    @Body('autoSave') autoSave: boolean,
    @UploadedFile() file: Express.Multer.File
  ) {
    const FORMATIONS_LIMIT = 3;
    const EXPERIENCES_LIMIT = 5;

    if (createCVDto.formations?.length > FORMATIONS_LIMIT) {
      throw new BadRequestException(
        `Vous ne pouvez dépasser ${FORMATIONS_LIMIT} formations dans le CV`
      );
    }

    if (createCVDto.experiences?.length > EXPERIENCES_LIMIT) {
      throw new BadRequestException(
        `Vous ne pouvez dépasser ${EXPERIENCES_LIMIT} expériences dans le CV`
      );
    }

    if (isRoleIncluded(CandidateUserRoles, role)) {
      createCVDto.status = CVStatuses.PROGRESS.value;
    } else if (isRoleIncluded(CoachUserRoles, role)) {
      if (
        createCVDto.status !== CVStatuses.PROGRESS.value &&
        createCVDto.status !== CVStatuses.PENDING.value
      ) {
        createCVDto.status = CVStatuses.PROGRESS.value;
      }
    } else if (role === UserRoles.ADMIN) {
      // on laisse la permission à l'admin de choisir le statut à enregistrer
      if (!createCVDto.status) {
        createCVDto.status = CVStatuses.PUBLISHED.value;
      }
    } else {
      createCVDto.status = CVStatuses.UNKNOWN.value;
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

    if (
      isRoleIncluded(CoachUserRoles, role) &&
      status === CVStatuses.PENDING.value
    ) {
      await this.cvsService.sendMailsAfterSubmitting(
        user as User,
        candidateId,
        createdCV
      );
    }

    if (!autoSave) {
      if (status === CVStatuses.PUBLISHED.value) {
        await this.cvsService.sendCacheCV(candidateId);
        await this.cvsService.sendCacheAllCVs();
        await this.cvsService.sendGenerateCVSearchString(candidateId);

        const cvs = await this.cvsService.findAllVersionsByCandidateId(
          candidateId
        );

        const hasPublishedAtLeastOnce =
          cvs?.filter(({ status }) => {
            return status === CVStatuses.PUBLISHED.value;
          }).length > 1;

        if (!hasPublishedAtLeastOnce) {
          await this.cvsService.sendMailsAfterPublishing(candidateId);
          // disable automatic recommandation
          // await this.cvsService.sendOffersAfterPublishing(
          //   candidateId,
          //   createCVDto.locations,
          //   createCVDto.businessLines
          // );
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

  @Public()
  @Get('cards/random')
  async findAllPublishedCVs(
    @Query()
    query: {
      nb: number;
      search: string;
    } & FilterParams<CVFilterKey>
  ) {
    return this.cvsService.findAllPublished(query);
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

  @UserPermissions(Permissions.CANDIDATE, Permissions.COACH)
  @UseGuards(UserPermissionsGuard)
  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Get('checkUpdate/:candidateId')
  async checkCVHasBeenModified(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string
  ) {
    const cv = await this.cvsService.findOneByCandidateId(candidateId);

    return {
      cvHasBeenModified: cv
        ? !!cv.lastModifiedBy && cv.lastModifiedBy !== userId
        : false,
    };
  }

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @UserPermissions(Permissions.CANDIDATE, Permissions.COACH)
  @UseGuards(UserPermissionsGuard)
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
  @Get('url/:url')
  async findCVByUrl(@Param('url') url: string) {
    const cv = await this.cvsService.findOneByUrl(url);

    const userCandidate = await this.cvsService.findOneUserCandidateByUrl(url);

    const exists = cv ? true : !!userCandidate;
    if (!exists) {
      throw new NotFoundException();
    }
    return {
      cv,
      exists,
    };
  }

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Get(':candidateId')
  async findCVByCandidateId(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string
  ) {
    const cv = await this.cvsService.findOneByCandidateId(candidateId);

    if (!cv) {
      throw new NotFoundException();
    }
    return cv;
  }
}
