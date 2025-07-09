import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LanguagesModule } from 'src/common/languages/languages.module';
import { SkillsModule } from 'src/common/skills/skills.module';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { OpenAiModule } from 'src/external-services/openai/openai.module';
import { MessagesModule } from 'src/messages/messages.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { ExternalCvsController } from './external-cvs.controller';
import { ExternalCvsService } from './external-cvs.service';
import { ExtractedCVData } from './models/extracted-cv-data.model';

@Module({
  imports: [
    SequelizeModule.forFeature([ExtractedCVData]),
    UserProfilesModule,
    AWSModule,
    forwardRef(() => MessagesModule),
    OpenAiModule,
    LanguagesModule,
    SkillsModule,
  ],
  controllers: [ExternalCvsController],
  providers: [ExternalCvsService],
  exports: [ExternalCvsService],
})
export class ExternalCvsModule {}
