import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BusinessLinesModule } from 'src/common/business-lines/business-lines.module';
import { ContractsModule } from 'src/common/contracts/contracts.module';
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
import { OpportunityUserEvent } from './models/opportunity-user-event.model';
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
      OpportunityUserEvent,
    ]),
    UsersModule,
    ContractsModule,
    CVsModule,
    BusinessLinesModule,
    MailsModule,
    SMSModule,
    ExternalDatabasesModule,
    QueuesModule,
  ],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, OpportunityUsersService],
  exports: [SequelizeModule, OpportunitiesService, OpportunityUsersService],
})
export class OpportunitiesModule {}
