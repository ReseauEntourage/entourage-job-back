import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ProfileGenerationService } from '../producers/profile-generation.service';
import { QueuesModule } from '../producers/queues.module';
import { LanguagesModule } from 'src/common/languages/languages.module';
import { ExtractedCVData } from 'src/external-cvs/models/extracted-cv-data.model';
import { OpenAiModule } from 'src/external-services/openai/openai.module';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { ProfileGeneratorProcessor } from './profile-generator.processor';

@Module({
  imports: [
    SequelizeModule.forFeature([ExtractedCVData]),
    QueuesModule,
    forwardRef(() => UserProfilesModule),
    LanguagesModule,
    OpenAiModule,
  ],
  providers: [
    ProfileGeneratorProcessor,
    PusherService,
    ProfileGenerationService,
  ],
  exports: [
    ProfileGeneratorProcessor,
    ProfileGenerationService,
    SequelizeModule,
  ],
})
export class ProfileGenerationModule {}
