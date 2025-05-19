import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
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
// eslint-disable-next-line import/no-extraneous-dependencies
import axios from 'axios';
import _ from 'lodash';
// eslint-disable-next-line import/no-extraneous-dependencies
import { PDFDocument } from 'pdf-lib';
import { fromPath } from 'pdf2pic';
import { RequestWithAuthorizationHeader } from 'src/auth/auth.types';
import { getTokenFromHeaders } from 'src/auth/auth.utils';
import { Public, UserPayload } from 'src/auth/guards';
import { S3Service } from 'src/external-services/aws/s3.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
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
    private readonly s3Service: S3Service,
    private readonly userProfilesService: UserProfilesService
  ) {}

  @ApiBearerAuth()
  @Get('generate-profile-from-cv')
  async generateProfileFromCV(
    @UserPayload('id', new ParseUUIDPipe()) userId: string
  ) {
    try {
      // Récupération du CV depuis AWS S3
      const userProfile = await this.userProfilesService.findOneByUserId(
        userId
      );

      if (!userProfile || !userProfile.hasExternalCv) {
        throw new NotFoundException();
      }

      // Construction de la clé S3 pour le CV externe
      const pdfUrl = `https://entourage-job-preprod.s3.eu-west-3.amazonaws.com/files/external-cvs/${userId}.pdf`;

      // Création du dossier temporaire s'il n'existe pas
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Téléchargement du PDF
      const pdfPath = path.join(tempDir, `${userId}.pdf`);
      const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      if (response.status !== 200) {
        throw new InternalServerErrorException(
          'Erreur lors du téléchargement du PDF'
        );
      }
      const pdfBuffer = Buffer.from(response.data);
      fs.writeFileSync(pdfPath, pdfBuffer);

      // Calcul du hash du fichier PDF pour le comparer avec la version précédente
      const fileHash = createHash('md5').update(pdfBuffer).digest('hex');

      // Vérification si une nouvelle extraction est nécessaire
      const needExtraction = await this.cvsService.shouldExtractCV(
        userId,
        fileHash
      );

      if (!needExtraction) {
        // Si le CV est inchangé, on utilise les données déjà extraites
        return;
      }

      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();

      try {
        // Configuration des options de conversion
        const options = {
          saveFilename: `${userId}`, // Préfixe des noms de fichiers
          savePath: tempDir, // Dossier de destination
          format: 'png', // Format de l'image
          preserveAspectRatio: true,
          width: 1000, // Largeur max en pixels
        };

        // Conversion du PDF en images
        const convert = fromPath(pdfPath, options);
        const pagesResult = await convert(pageCount, {
          responseType: 'base64',
        });

        // Extraction des données du CV à partir des images
        const extractedCVData = await this.cvsService.extractDataFromCVImages(
          pagesResult
        );

        // Sauvegarde des données extraites et du hash du fichier dans la base de données
        await this.cvsService.saveExtractedCVData(
          userId,
          extractedCVData,
          fileHash
        );

        return {
          success: true,
          message:
            'Les données du CV ont été extraites et sauvegardées avec succès',
          cached: false,
        };
      } catch (error) {
        console.error('Erreur lors du traitement du PDF:', error);
        throw new InternalServerErrorException(
          'Erreur lors du traitement du PDF: ' + error
        );
      } finally {
        // Nettoyage des fichiers temporaires
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
      }
    } catch (error) {
      console.error('Error extracting CV data:', error);
      throw new InternalServerErrorException(
        'Failed to extract CV data: ' + error
      );
    }
  }

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
        }
      }

      if (file) {
        await this.cvsService.uploadCVImage(file, candidateId, status);
      } else if (oldImg) {
        // Else if there is an old image,we copy it to the new one status
        await this.s3Service.copyFile(
          oldImg,
          `${createCVDto.UserId}.${createCVDto.status}.jpg`
        );
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
