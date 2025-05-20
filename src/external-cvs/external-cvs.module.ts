import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ExtractedCVData } from 'dist/src/cvs/models';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { OpenAiModule } from 'src/external-services/openai/openai.module';
import { MessagesModule } from 'src/messages/messages.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { ExternalCvsController } from './external-cvs.controller';
import { ExternalCvsService } from './external-cvs.service';

@Module({
  imports: [
    SequelizeModule.forFeature([ExtractedCVData]),
    UserProfilesModule,
    AWSModule,
    MessagesModule,
    OpenAiModule,
  ],
  controllers: [ExternalCvsController],
  providers: [ExternalCvsService],
  exports: [ExternalCvsService],
})
export class ExternalCvsModule {}
