import {
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import _ from 'lodash';
import { RequestWithAuthorizationHeader } from 'src/auth/auth.types';
import { getTokenFromHeaders } from 'src/auth/auth.utils';
import { Public, UserPayload } from 'src/auth/guards';
import { S3Service } from 'src/external-services/aws/s3.service';
import {
  LinkedUser,
  LinkedUserGuard,
  UserPermissions,
  UserPermissionsGuard,
} from 'src/users/guards';
import { User } from 'src/users/models';
import {
  AllUserRoles,
  CVStatuses,
  Permissions,
  UserRole,
  UserRoles,
} from 'src/users/users.types';
import { isRoleIncluded } from 'src/users/users.utils';
import { FilterParams } from 'src/utils/types';
import { CVsService } from './cvs.service';
import { CVFilterKey } from './cvs.types';
import { getPDFPaths } from './cvs.utils';
import { CreateCVDto } from './dto';
import { ParseCVPipe } from './dto/parse-cv.pipe';

// TODO change to /cvs
@ApiTags('CVs')
@Controller('cv')
export class CVsController {
  constructor(
    private readonly cvsService: CVsService,
    private readonly s3Service: S3Service
  ) {}

  /*
  This route is used to create a new VERSION of the CV
  there is no update of existing CV, only creation of a newer version
  */
  @ApiBearerAuth()
  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @UseInterceptors(FileInterceptor('profileImage', { dest: 'uploads/' }))
  @Post(':candidateId')
  async createCV(
    @Req() req: RequestWithAuthorizationHeader,
    @UserPayload() user: User,
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @UserPayload('role') role: UserRole,
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Body('cv', new ParseCVPipe()) createCVDto: CreateCVDto,
    @Body('autoSave') autoSave: boolean,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (isRoleIncluded(AllUserRoles, role)) {
      // uniquement coach et candidat  => ne peuvent que créer un cv en mode "pending"
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

    // enregistrement de l'image uniquement si ce n'est pas un autosave
    if (!autoSave && (createCVDto.urlImg || file)) {
      oldImg = createCVDto.urlImg;
      createCVDto.urlImg = urlImg;
    }

    const createdCV = await this.cvsService.create(
      { UserId: candidateId, ...createCVDto } as CreateCVDto,
      userId
    );

    const { status } = createdCV;

    // on envoie un email de notif a l'admin lorsqu'un cv est en attente de validation
    if (status === CVStatuses.PENDING.value) {
      await this.cvsService.sendMailsAfterSubmitting(
        user,
        candidateId,
        createdCV
      );
    }
    // uniquement pour la validation admin du CV
    if (!autoSave) {
      if (status === CVStatuses.PUBLISHED.value) {
        await this.cvsService.sendCacheCV(candidateId);
        await this.cvsService.sendCacheAllCVs();
        await this.cvsService.sendGenerateCVSearchString(candidateId);
        // première validation => envoi de mail de notif au candidat et coach avec contenu pédago
        const hasPublishedAtLeastOnce =
          await this.cvsService.findHasAtLeastOnceStatusByCandidateId(
            candidateId,
            CVStatuses.PUBLISHED.value
          );

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

      if (file) {
        await this.cvsService.uploadCVImage(file, candidateId, status);
      } else if (oldImg) {
        // Else if there is an old image,we copy it to the new one status
        try {
          await this.s3Service.copyFile(
            oldImg,
            `${createCVDto.UserId}.${createCVDto.status}.jpg`
          );
        } catch (error) {
          console.error('Error copying image', error);
        }
      }

      const { firstName, lastName } = createdCV.user.candidat;

      const token = getTokenFromHeaders(req);

      // génération du CV en version PDF; exécution par lambda AWS
      await this.cvsService.sendGenerateCVPDF(
        candidateId,
        token,
        `${firstName}_${lastName}`
      );
    }
    return createdCV;
  }

  /*
  récupérer une liste de CVs publiés aléatoirement pour la gallerie
  */
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

  @ApiBearerAuth()
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

  @ApiBearerAuth()
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
        fileName
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

  @ApiBearerAuth()
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

  @ApiBearerAuth()
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

  @ApiBearerAuth()
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
