import { Module } from '@nestjs/common';
import { CVsModule } from 'src/cvs/cvs.module';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { MailsModule } from 'src/mails/mails.module';
import { RevisionsModule } from 'src/revisions/revisions.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { UsersDeletionController } from './users-deletion.controller';
import { UsersDeletionService } from './users-deletion.service';

@Module({
  imports: [
    CVsModule,
    UserProfilesModule,
    UsersModule,
    AWSModule,
    RevisionsModule,
    MailsModule,
  ],
  controllers: [UsersDeletionController],
  providers: [UsersDeletionService],
  exports: [UsersDeletionService],
})
export class UsersDeletionModule {}
