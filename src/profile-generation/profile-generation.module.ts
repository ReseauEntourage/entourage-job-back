import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ExternalCvsModule } from 'src/external-cvs/external-cvs.module';
import { ExtractedCVData } from 'src/external-cvs/models/extracted-cv-data.model';
import { AnthropicModule } from 'src/external-services/anthropic/anthropic.module';
import { LanguagesModule } from 'src/languages/languages.module';
import { ProfileGenerationService } from 'src/profile-generation/profile-generation.service';
import { QueuesModule } from 'src/queues/producers/queues.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { ProfileGenerationController } from './profile-generation.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([ExtractedCVData]),
    forwardRef(() => QueuesModule),
    forwardRef(() => UserProfilesModule),
    forwardRef(() => ExternalCvsModule),
    forwardRef(() => UsersModule),
    LanguagesModule,
    AnthropicModule,
  ],
  controllers: [ProfileGenerationController],
  providers: [ProfileGenerationService],
  exports: [QueuesModule, ProfileGenerationService],
})
export class ProfileGenerationModule {}
