import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { OpenAiModule } from 'src/external-services/openai/openai.module';
import { Media } from 'src/medias/models';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { ExternalCvsController } from './external-cvs.controller';
import { ExternalCvsService } from './external-cvs.service';
import { ExternalCv } from './models/external-cv.model';
import { ExtractedCVData } from './models/extracted-cv-data.model';

@Module({
  imports: [
    SequelizeModule.forFeature([ExtractedCVData, ExternalCv, Media]),
    UserProfilesModule,
    AWSModule,
    OpenAiModule,
  ],
  controllers: [ExternalCvsController],
  providers: [ExternalCvsService],
  exports: [ExternalCvsService, SequelizeModule],
})
export class ExternalCvsModule {}
