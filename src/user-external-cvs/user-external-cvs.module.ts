import { Module } from '@nestjs/common';
import { AmbitionsModule } from 'src/common/ambitions/ambitions.module';
import { BusinessLinesModule } from 'src/common/business-lines/business-lines.module';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { MessagesModule } from 'src/messages/messages.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { UserExternalCvsController } from './user-external-cvs.controller';
import { UserExternalCvsService } from './user-external-cvs.service';

@Module({
  imports: [
    UsersModule,
    UserProfilesModule,
    AmbitionsModule,
    BusinessLinesModule,
    AWSModule,
    MessagesModule,
  ],
  controllers: [UserExternalCvsController],
  providers: [UserExternalCvsService],
  exports: [UserExternalCvsService],
})
export class UserExternalCvsModule {}
