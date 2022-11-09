import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
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
} from './models';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { OpportunityUsersService } from './opportunity-users.service';
import { ContactsModule } from 'src/contacts/contacts.module';
@Module({
  imports: [
    SequelizeModule.forFeature([
      Opportunity,
      OpportunityUser,
      OpportunityBusinessLine,
    ]),
    UsersModule,
    CVsModule,
    BusinessLinesModule,
    MailsModule,
    ContactsModule,
    SMSModule,
    ExternalDatabasesModule,
    QueuesModule,
  ],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, OpportunityUsersService],
  exports: [SequelizeModule, OpportunitiesService, OpportunityUsersService],
})
export class OpportunitiesModule {}
