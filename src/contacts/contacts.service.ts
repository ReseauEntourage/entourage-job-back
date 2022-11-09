import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import qs from 'qs';
import { SalesforceService } from '../external-services/salesforce/salesforce.service';
import { ContactCompanyFormDto, ContactUsFormDto } from 'src/mails/dto';
import { MailsService } from 'src/mails/mails.service';
import {
  ContactStatus,
  PleziContactRegions,
  PleziContactStatuses,
  PleziNewsletterId,
  PleziTrackingData,
} from 'src/mails/mails.types';
import { AdminZone } from 'src/utils/types';

@Injectable()
export class ContactsService {
  constructor(
    private mailsService: MailsService,
    private salesforceService: SalesforceService
  ) {}

  async sendContactToPlezi(
    email: string,
    zone: AdminZone | AdminZone[],
    status: ContactStatus | ContactStatus[],
    visit?: PleziTrackingData['visit'],
    visitor?: PleziTrackingData['visitor'],
    urlParams?: PleziTrackingData['urlParams']
  ) {
    const queryParams = `${qs.stringify(
      {
        visit,
        visitor,
        form_id: process.env.PLEZI_FORM_ID,
        content_web_form_id: process.env.PLEZI_CONTENT_WEB_FORM_ID,
        email,
        plz_ma_region: Array.isArray(zone)
          ? zone.map((singleZone) => {
              return PleziContactRegions[singleZone];
            })
          : PleziContactRegions[zone],
        plz_je_suis: Array.isArray(status)
          ? status.map((singleStatus) => {
              return PleziContactStatuses[singleStatus];
            })
          : PleziContactStatuses[status],
        keep_multiple_select_values: true,
        subscriptions: PleziNewsletterId,
      },
      { encode: false, arrayFormat: 'comma' }
    )}${
      urlParams
        ? `&${qs.stringify(urlParams, {
            encode: false,
          })}`
        : ''
    }`;

    const pleziApiRoute = `https://app.plezi.co/api/v1/create_contact_after_webform`;

    const response = await fetch(`${pleziApiRoute}?${queryParams}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Tenant-Company': process.env.PLEZI_TENANT_NAME,
        'X-API-Key': process.env.PLEZI_API_KEY,
      },
      method: 'GET',
    });

    const responseJSON = await response.json();

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(
        `${response.status}, ${responseJSON.errors[0].title}, ${responseJSON.errors[0].detail}`
      );
    }
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
