import { Module } from '@nestjs/common';
import { QueuesModule } from 'src/queues/producers';
import { MailsController } from './mails.controller';
import { MailsService } from './mails.service';

@Module({
  imports: [QueuesModule],
  controllers: [MailsController],
  providers: [MailsService],
  exports: [MailsService],
})
export class MailsModule {}
