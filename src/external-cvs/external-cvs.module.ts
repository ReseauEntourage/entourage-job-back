import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmbitionsModule } from 'src/common/ambitions/ambitions.module';
import { BusinessLinesModule } from 'src/common/business-lines/business-lines.module';
import { ExtractedCVData } from 'src/cvs/models';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { OpenAiModule } from 'src/external-services/openai/openai.module';
import { MessagesModule } from 'src/messages/messages.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { ExternalCvsController } from './external-cvs.controller';
import { ExternalCvsService } from './external-cvs.service';

@Module({
  imports: [
    SequelizeModule.forFeature([ExtractedCVData]),
    UsersModule,
    UserProfilesModule,
    AmbitionsModule,
    BusinessLinesModule,
    AWSModule,
    MessagesModule,
    OpenAiModule,
  ],
  controllers: [ExternalCvsController],
  providers: [ExternalCvsService],
  exports: [ExternalCvsService],
})
export class ExternalCvsModule {}
