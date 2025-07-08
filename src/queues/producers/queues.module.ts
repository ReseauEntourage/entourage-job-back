import { BullModule } from '@nestjs/bull';
import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LanguagesModule } from 'src/common/languages/languages.module';
import { ExtractedCVData } from 'src/external-cvs/models/extracted-cv-data.model';
import {
  getBullWorkQueueOptions,
  getBullProfileGenerationQueueOptions,
} from 'src/queues/queues.utils';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { ProfileGenerationService } from './profile-generation.service';
import { QueuesService } from './queues.service';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    BullModule.registerQueue(getBullProfileGenerationQueueOptions()),
    SequelizeModule.forFeature([ExtractedCVData]),
    LanguagesModule,
    forwardRef(() => UserProfilesModule),
  ],
  providers: [QueuesService, ProfileGenerationService],
  exports: [QueuesService, ProfileGenerationService, SequelizeModule],
})
export class QueuesModule {}
