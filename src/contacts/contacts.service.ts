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
import { ContactCandidateFormDto } from './dto/contact-candidate-form.dto';
import { InscriptionCandidateFormDto } from './dto/inscription-candidate-form.dto';

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

  async sendCompanyContactToSalesforce(
    contactCompanyFormDto: ContactCompanyFormDto
  ) {
    return this.salesforceService.createOrUpdateCompanySalesforceLead(
      contactCompanyFormDto
    );
  }

  async sendCandidateContactToSalesforce(
    contactCandidateFormDto: ContactCandidateFormDto
  ) {
    return this.salesforceService.createOrUpdateContactCandidateSalesforceLead(
      contactCandidateFormDto
    );
  }

  async sendCandidateInscriptionToSalesforce(
    inscriptionCandidateFormDto: InscriptionCandidateFormDto
  ) {
    return this.salesforceService.createOrUpdateInscriptionCandidateSalesforceLead(
      inscriptionCandidateFormDto
    );
  }

  async sendContactUsMail(contactUsFormDto: ContactUsFormDto) {
    return this.mailsService.sendContactUsMail(contactUsFormDto);
  }

  async getCampaignsFromSF() {
    return this.salesforceService.getCampaigns();
  }
}
