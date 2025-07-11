import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import axios from 'axios';
import { UserPayload } from 'src/auth/guards';
import { Timeout } from 'src/common/decorators';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { User } from 'src/users/models';
import { ExternalCvsService } from './external-cvs.service';

@ApiTags('ExternalCvs')
@ApiBearerAuth()
@Controller('external-cv')
export class ExternalCvsController {
  constructor(
    private readonly externalCvsService: ExternalCvsService,
    private readonly userProfilesService: UserProfilesService
  ) {}

  /**
   * POST /external-cv - Uploads an external CV for the current user
   * @param file - The file to be uploaded
   * @param user - The current user signed in
   * @returns { url: string } - The URL of the uploaded file
   * @throws { BadRequestException } - If the user is not a candidate or if no file is provided
   * @throws { InternalServerErrorException } - If the file could not be uploaded
   */
  @UseInterceptors(FileInterceptor('file', { dest: 'uploads/' }))
  @Post()
  async uploadExternalCV(
    @UploadedFile() file: Express.Multer.File,
    @UserPayload() user: User
  ) {
    if (!file) {
      throw new BadRequestException();
    }

    try {
      const externalCvS3Key = await this.externalCvsService.uploadExternalCV(
        user.id,
        file
      );
      const cvFile = await this.externalCvsService.findExternalCv(
        externalCvS3Key
      );
      return { url: cvFile };
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }

  /**
   * GET /external-cv/generate-profile-from-cv - Génère un profil utilisateur à partir des données du CV
   * @param user - L'utilisateur actuel connecté
   */
  @ApiBearerAuth()
  @Get('generate-profile-from-cv')
  @Timeout(60000)
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
      const pdfUrl = `https://${process.env.AWSS3_BUCKET_NAME}.s3.eu-west-3.amazonaws.com/${process.env.AWSS3_FILE_DIRECTORY}external-cvs/${userId}.pdf`;

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
      const needExtraction = await this.externalCvsService.shouldExtractCV(
        userProfile.id,
        fileHash
      );

      let extractedCVData;

      if (needExtraction) {
        try {
          const base64Image =
            await this.externalCvsService.convertPdfToPngBase64(pdfPath);

          // Extraction des données du CV à partir des images
          extractedCVData =
            await this.externalCvsService.extractDataFromCVImages(base64Image);

          // Sauvegarde des données extraites et du hash du fichier dans la base de données
          await this.externalCvsService.saveExtractedCVData(
            userProfile.id,
            extractedCVData,
            fileHash
          );
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
      } else {
        extractedCVData = await this.externalCvsService.getExtractedCVData(
          userProfile.id
        );
      }

      // Remplir le profil utilisateur avec les données extraites du CV
      if (extractedCVData) {
        await this.externalCvsService.populateUserProfileFromCVData(
          userId,
          extractedCVData
        );

        return;
      }
    } catch (error) {
      console.error('Error extracting CV data:', error);
      throw new InternalServerErrorException('Failed to extract CV data: ');
    }
  }

  /**
   * GET /external-cv/:userId - Finds the external CV for the current user
   * @param user - The current user signed in
   * @returns cvFile
   * @throws { InternalServerErrorException } - If the file could not be found
   * @throws { NotFoundException } - If the user does not have an external CV
   */
  @Get(':userId')
  async findExternalCv(@Param('userId') userId: string) {
    const userProfile = await this.userProfilesService.findOneByUserId(userId);
    if (!userProfile) {
      throw new InternalServerErrorException();
    }
    if (!userProfile.hasExternalCv) {
      throw new NotFoundException();
    }
    const cvFile = await this.externalCvsService.findExternalCv(
      `files/external-cvs/${userId}.pdf`
    );
    return { url: cvFile };
  }

  /**
   * DELETE /external-cv - Deletes the external CV for the current user
   * @param user - The current user signed in
   */
  @Delete()
  async deleteExternalCv(@UserPayload() user: User) {
    await this.externalCvsService.deleteExternalCv(user.id);
  }
}
