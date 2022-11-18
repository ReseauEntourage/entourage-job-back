import { Injectable } from '@nestjs/common';

import { ContactCompanyFormDto, ContactUsFormDto } from 'src/contacts/dto';
import { PleziService } from 'src/external-services/plezi/plezi.service';
import {
  ContactStatus,
  PleziTrackingData,
} from 'src/external-services/plezi/plezi.types';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { MailsService } from 'src/mails/mails.service';
import { AdminZone } from 'src/utils/types';

@Injectable()
export class ContactsService {
  constructor(
    private mailsService: MailsService,
    private salesforceService: SalesforceService,
    private pleziService: PleziService
  ) {}

  async sendContactToPlezi(
    email: string,
    zone: AdminZone | AdminZone[],
    status: ContactStatus | ContactStatus[],
    visit?: PleziTrackingData['visit'],
    visitor?: PleziTrackingData['visitor'],
    urlParams?: PleziTrackingData['urlParams']
  ) {
    return this.pleziService.sendContactToPlezi(
      email,
      zone,
      status,
      visit,
      visitor,
      urlParams
    );
  }

  async sendContactToSalesforce(contactCompanyFormDto: ContactCompanyFormDto) {
    return this.salesforceService.createOrUpdateSalesforceLead(
      contactCompanyFormDto
    );
  }

  async sendContactUsMail(contactUsFormDto: ContactUsFormDto) {
    return this.mailsService.sendContactUsMail(contactUsFormDto);
  }
}