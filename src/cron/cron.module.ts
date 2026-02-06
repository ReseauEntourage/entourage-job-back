import { Module } from '@nestjs/common';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { QueuesModule } from 'src/queues/producers';
import { UsersModule } from 'src/users/users.module';
import { UsersDeletionModule } from 'src/users-deletion/users-deletion.module';
import { CronService } from './cron.service';

@Module({
  imports: [UsersModule, UsersDeletionModule, SlackModule, QueuesModule],
  providers: [CronService],
})
export class CronModule {}
