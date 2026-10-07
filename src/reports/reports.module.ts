import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { User } from 'src/users/models';
import { Report, ReportSlackMessage } from './models';
import { ReportsService } from './reports.service';

/**
 * Generic reports storage, shared by every reported domain (help group
 * messages today). Exposes no route.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([Report, ReportSlackMessage, User]),
    SlackModule,
  ],
  providers: [ReportsService],
  exports: [SequelizeModule, ReportsService],
})
export class ReportsModule {}
