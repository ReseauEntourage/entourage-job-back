import { createHash } from 'crypto';
import {
  Controller,
  Get,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import axios from 'axios';
import { JwtAuthGuard, UserPayload } from 'src/auth/guards';
import { ProfileGenerationService } from 'src/queues/producers/profile-generation.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';

@ApiTags('profile-generation')
@Controller('profile-generation')
@UseGuards(JwtAuthGuard)
export class ProfileGenerationController {
  constructor(
    private readonly profileGenerationService: ProfileGenerationService,
    private readonly userProfilesService: UserProfilesService
  ) {}

  @ApiBearerAuth()
  @Get('generate-profile-from-cv')
  async generateFromPDF(
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
      const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      if (response.status !== 200) {
        throw new InternalServerErrorException(
          'Erreur lors du téléchargement du PDF'
        );
      }
      const pdfBuffer = Buffer.from(response.data);
      // Calcul du hash du fichier PDF pour le comparer avec la version précédente
      const fileHash = createHash('md5').update(pdfBuffer).digest('hex');

      // Vérification si une nouvelle extraction est nécessaire
      const needExtraction =
        await this.profileGenerationService.shouldExtractCV(
          userProfile.id,
          fileHash
        );

      let extractedCVData;

      if (needExtraction) {
        try {
          // Création d'un job de génération de profil à partir du PDF
          return this.profileGenerationService.generateProfileFromPDF({
            s3Key: `external-cvs/${userId}.pdf`,
            userProfileId: userProfile.id,
            userId,
            fileHash,
          });
        } catch (error) {
          console.error('Erreur lors du traitement du PDF:', error);
          throw new InternalServerErrorException(
            'Erreur lors du traitement du PDF: ' + error
          );
        }
      } else {
        extractedCVData =
          await this.profileGenerationService.getExtractedCVData(
            userProfile.id
          );
        await this.profileGenerationService.populateUserProfileFromCVData(
          userId,
          extractedCVData
        );
      }
    } catch (error) {
      console.error('Error extracting CV data:', error);
      throw new InternalServerErrorException('Failed to extract CV data: ');
    }
  }
}
