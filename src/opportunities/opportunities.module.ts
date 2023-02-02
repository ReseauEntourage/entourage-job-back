import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PleziModule } from '../external-services/plezi/plezi.module';
import { BusinessLinesModule } from 'src/common/businessLines/businessLines.module';
import { CVsModule } from 'src/cvs/cvs.module';
import { ExternalDatabasesModule } from 'src/external-databases/external-databases.module';
import { MailsModule } from 'src/mails/mails.module';
import { QueuesModule } from 'src/queues/producers';
import { SMSModule } from 'src/sms/sms.module';
import { UsersModule } from 'src/users/users.module';
import {
  Opportunity,
  OpportunityBusinessLine,
  OpportunityUser,
  OpportunityUserStatusChange,
} from './models';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { OpportunityUsersService } from './opportunity-users.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Opportunity,
      OpportunityUser,
      OpportunityBusinessLine,
      OpportunityUserStatusChange,
    ]),
    UsersModule,
    CVsModule,
    BusinessLinesModule,
    MailsModule,
    PleziModule,
    SMSModule,
    ExternalDatabasesModule,
    QueuesModule,
  ],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, OpportunityUsersService],
  exports: [SequelizeModule, OpportunitiesService, OpportunityUsersService],
})
export class OpportunitiesModule {}
