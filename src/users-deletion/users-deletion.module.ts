import { forwardRef, Module } from '@nestjs/common';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { MailsModule } from 'src/mails/mails.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { UsersDeletionController } from './users-deletion.controller';
import { UsersDeletionService } from './users-deletion.service';

@Module({
  imports: [
    forwardRef(() => UserProfilesModule),
    forwardRef(() => UsersModule),
    AWSModule,
    MailsModule,
  ],
  controllers: [UsersDeletionController],
  providers: [UsersDeletionService],
})
export class UsersDeletionModule {}
