import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ExternalDatabasesModule } from 'src/external-databases/external-databases.module';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { MailsModule } from 'src/mails/mails.module';
import { UsersModule } from 'src/users/users.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ExternalMessage, InternalMessage } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([ExternalMessage, InternalMessage]),
    MailsModule,
    SlackModule,
    forwardRef(() => UsersModule),
    ExternalDatabasesModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [SequelizeModule, MessagesService],
})
export class MessagesModule {}
