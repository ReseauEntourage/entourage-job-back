import { BullModule } from '@nestjs/bull';
import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { ProfileGenerationService } from '../producers/profile-generation.service';
import { LanguagesModule } from 'src/common/languages/languages.module';
import { ExtractedCVData } from 'src/external-cvs/models/extracted-cv-data.model';
import { OpenAiModule } from 'src/external-services/openai/openai.module';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { getBullProfileGenerationQueueOptions } from 'src/queues/queues.utils';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { ProfileGeneratorProcessor } from './profile-generator.processor';

@Module({
  imports: [
    BullModule.registerQueue(getBullProfileGenerationQueueOptions()),
    SequelizeModule.forFeature([ExtractedCVData]),
    OpenAiModule,
    LanguagesModule,
    forwardRef(() => UserProfilesModule),
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
