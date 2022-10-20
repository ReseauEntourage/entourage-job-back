import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Public } from '../auth/guards';
import { isValidPhone } from '../utils/misc';
import { ContactStatus } from 'src/external-services/mailchimp/mailchimp.types';
import { AdminZone } from 'src/utils/types';
import { ContactUsFormDto, ContactUsFormPipe } from './dto';
import { MailsService } from './mails.service';

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
    @Body('status') status: ContactStatus | ContactStatus[]
  ) {
    if (!email) {
      throw new BadRequestException();
    }
    return this.mailsService.sendContactToMailchimp(email, zone, status);
  }
}
