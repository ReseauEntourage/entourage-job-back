import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ExternalDatabasesModule } from 'src/external-databases/external-databases.module';
import { MailsModule } from 'src/mails/mails.module';
import { UsersModule } from 'src/users/users.module';
import { ExternalMessagesController } from './external-messages.controller';
import { ExternalMessagesService } from './external-messages.service';
import { ExternalMessage } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([ExternalMessage]),
    MailsModule,
    UsersModule,
    ExternalDatabasesModule,
  ],
  controllers: [ExternalMessagesController],
  providers: [ExternalMessagesService],
  exports: [SequelizeModule, ExternalMessagesService],
})
export class ExternalMessagesModule {}
