import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Public } from 'src/auth/guards';
import { isValidPhone } from 'src/utils/misc';
import { AdminZone } from 'src/utils/types';
import { ContactUsFormDto, ContactUsFormPipe } from './dto';
import { MailsService } from './mails.service';
import { ContactStatus } from './mails.types';

// TODO change to mails
@Controller('mail')
export class MailsController {
  constructor(private readonly mailsService: MailsService) {}

  // TODO change to contactUs
  @Public()
  @Post('contact-us')
  async sendMailContactUsForm(
    @Body(new ContactUsFormPipe()) contactUsFormDto: ContactUsFormDto
  ) {
    if (contactUsFormDto.phone && !isValidPhone(contactUsFormDto.phone)) {
      throw new BadRequestException();
    }

    return this.mailsService.sendContactUsMail(contactUsFormDto);
  }

  @Public()
  @Post('newsletter')
  async addContactForNewsletter(
    @Body('email') email: string,
    @Body('zone') zone: AdminZone | AdminZone[],
    @Body('status') status: ContactStatus | ContactStatus[],
    @Body('visit') visit: string,
    @Body('visitor') visitor: string,
    @Body('urlParams')
    urlParams?: {
      utm?: string;
      utm_medium?: string;
      utm_source?: string;
      gclid?: string;
      referer?: string;
    }
  ) {
    if (!email) {
      throw new BadRequestException();
    }

    return this.mailsService.sendContactToPlezi(
      email,
      zone,
      status,
      visit,
      visitor,
      urlParams
    );
  }
}
