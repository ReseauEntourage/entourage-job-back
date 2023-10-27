import { Injectable } from '@nestjs/common';
import { MailjetService } from '../external-services/mailjet/mailjet.service';
import { CustomContactParams } from '../external-services/mailjet/mailjet.types';
import { ContactCompanyFormDto, ContactUsFormDto } from 'src/contacts/dto';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { MailsService } from 'src/mails/mails.service';
import { ContactCandidateFormDto } from './dto/contact-candidate-form.dto';
import { InscriptionCandidateFormDto } from './dto/inscription-candidate-form.dto';

@Injectable()
export class ContactsService {
  constructor(
    private mailsService: MailsService,
    private salesforceService: SalesforceService,
    private mailjetService: MailjetService
  ) {}

  async sendContactToMailjet(contact: CustomContactParams) {
    return this.mailjetService.sendContact(contact);
  }

  async sendCompanyContactToSalesforce(
    contactCompanyFormDto: ContactCompanyFormDto
  ) {
    if (process.env.ENABLE_SF === 'true') {
      return this.salesforceService.createOrUpdateCompanySalesforceLead(
        contactCompanyFormDto
      );
    }
  }

  async sendCandidateContactToSalesforce(
    contactCandidateFormDto: ContactCandidateFormDto
  ) {
    if (process.env.ENABLE_SF === 'true') {
      return this.salesforceService.createOrUpdateContactCandidateSalesforceLead(
        contactCandidateFormDto
      );
    }
  }

  async sendCandidateInscriptionToSalesforce(
    inscriptionCandidateFormDto: InscriptionCandidateFormDto
  ) {
    if (process.env.ENABLE_SF === 'true') {
      return this.salesforceService.createOrUpdateInscriptionCandidateSalesforceLead(
        inscriptionCandidateFormDto
      );
    }
  }

  async sendContactUsMail(contactUsFormDto: ContactUsFormDto) {
    return this.mailsService.sendContactUsMail(contactUsFormDto);
  }

  async getCampaignsFromSF() {
    if (process.env.ENABLE_SF === 'true') {
      return this.salesforceService.getCampaigns();
    }
  }
}
