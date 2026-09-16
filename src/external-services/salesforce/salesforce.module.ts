import { Module } from '@nestjs/common';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { UsersModule } from 'src/users/users.module';
import { SalesforceService } from './salesforce.service';

@Module({
  imports: [UsersModule, SlackModule],
  providers: [SalesforceService],
  exports: [SalesforceService],
})
export class SalesforceModule {}
