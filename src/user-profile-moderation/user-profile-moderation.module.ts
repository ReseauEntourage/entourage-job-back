import { forwardRef, Module } from '@nestjs/common';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { MailsModule } from 'src/mails/mails.module';
import { UsersModule } from 'src/users/users.module';
import { UserProfileModerationService } from './user-profile-moderation.service';

@Module({
  imports: [forwardRef(() => UsersModule), SlackModule, MailsModule],
  providers: [UserProfileModerationService],
  exports: [UserProfileModerationService],
})
export class UserProfileModerationModule {}
