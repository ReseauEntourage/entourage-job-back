import { forwardRef, Module } from '@nestjs/common';
import { ExternalCvsModule } from 'src/external-cvs/external-cvs.module';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { MailsModule } from 'src/mails/mails.module';
import { UserProfileDeletionModule } from 'src/user-profile-deletion/user-profile-deletion.module';
import { UsersModule } from 'src/users/users.module';
import { UsersDeletionController } from './users-deletion.controller';
import { UsersDeletionService } from './users-deletion.service';

@Module({
  imports: [
    UserProfileDeletionModule,
    forwardRef(() => UsersModule),
    forwardRef(() => ExternalCvsModule),
    AWSModule,
    MailsModule,
  ],
  controllers: [UsersDeletionController],
  providers: [UsersDeletionService],
  exports: [UsersDeletionService],
})
export class UsersDeletionModule {}
