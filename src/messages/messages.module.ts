import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { MailsModule } from 'src/mails/mails.module';
import { UsersModule } from 'src/users/users.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { Message } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([Message]),
    MailsModule,
    UsersModule,
    SalesforceModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [SequelizeModule, MessagesService],
})
export class MessagesModule {}
