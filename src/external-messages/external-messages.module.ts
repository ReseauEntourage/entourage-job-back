import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { MailsModule } from 'src/mails/mails.module';
import { UsersModule } from 'src/users/users.module';
import { ExternalMessagesController } from './external-messages.controller';
import { ExternalMessagesService } from './external-messages.service';
import { Message } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([Message]),
    MailsModule,
    UsersModule,
    SalesforceModule,
  ],
  controllers: [ExternalMessagesController],
  providers: [ExternalMessagesService],
  exports: [SequelizeModule, ExternalMessagesService],
})
export class ExternalMessagesModule {}
