import { Module } from '@nestjs/common';
import { MailsService } from 'src/mails/mails.service';
import { MailsServiceMock } from './mails.service.mock';

@Module({
  providers: [
    {
      provide: MailsService,
      useClass: MailsServiceMock,
    },
  ],
  exports: [MailsService],
})
export class MailsTestingModule {}
