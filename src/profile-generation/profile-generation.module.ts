import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LanguagesModule } from 'src/common/languages/languages.module';
import { ExternalCvsModule } from 'src/external-cvs/external-cvs.module';
import { ExtractedCVData } from 'src/external-cvs/models/extracted-cv-data.model';
import { ProfileGenerationService } from 'src/queues/producers/profile-generation.service';
import { QueuesModule } from 'src/queues/producers/queues.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { ProfileGenerationController } from './profile-generation.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([ExtractedCVData]),
    forwardRef(() => QueuesModule),
    ExternalCvsModule,
    forwardRef(() => UserProfilesModule),
    LanguagesModule,
  ],
  controllers: [ProfileGenerationController],
  providers: [ProfileGenerationService],
  exports: [QueuesModule, ProfileGenerationService],
})
export class ProfileGenerationModule {}
