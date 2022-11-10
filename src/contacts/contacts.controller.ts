import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Public } from 'src/auth/guards';
import {
  ContactCompanyFormDto,
  ContactCompanyFormPipe,
  ContactUsFormDto,
  ContactUsFormPipe,
} from 'src/contacts/dto';
import {
  ContactStatus,
  PleziTrackingData,
} from 'src/external-services/plezi/plezi.types';
import { isValidPhone } from 'src/utils/misc';
import { AdminZone } from 'src/utils/types';
import { ContactsService } from './contacts.service';

// TODO change to /contacts
@Controller('contact')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  // TODO change to contactUs
  @Public()
  @Post('contact-us')
  async sendMailContactUsForm(
    @Body(new ContactUsFormPipe()) contactUsFormDto: ContactUsFormDto
  ) {
    if (contactUsFormDto.phone && !isValidPhone(contactUsFormDto.phone)) {
      throw new BadRequestException();
    }

    return this.contactsService.sendContactUsMail(contactUsFormDto);
  }

  @Public()
  @Post('company')
  async sendMailContactCompanyForm(
    @Body(new ContactCompanyFormPipe())
    contactCompanyFormDto: ContactCompanyFormDto
  ) {
    if (
      contactCompanyFormDto.phone &&
      !isValidPhone(contactCompanyFormDto.phone)
    ) {
      throw new BadRequestException();
    }

    return this.contactsService.sendContactToSalesforce(contactCompanyFormDto);
  }

  @Public()
  @Post('newsletter')
  async addContactForNewsletter(
    @Body('email') email: string,
    @Body('zone') zone: AdminZone | AdminZone[],
    @Body('status') status: ContactStatus | ContactStatus[],
    @Body('visit') visit?: PleziTrackingData['visit'],
    @Body('visitor') visitor?: PleziTrackingData['visitor'],
    @Body('urlParams')
    urlParams?: PleziTrackingData['urlParams']
  ) {
    if (!email) {
      throw new BadRequestException();
    }

    return this.contactsService.sendContactToPlezi(
      email,
      zone,
      status,
      visit,
      visitor,
      urlParams
    );
  }
}
