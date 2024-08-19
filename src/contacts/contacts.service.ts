import { Injectable } from '@nestjs/common';
import { ContactCompanyFormDto, ContactUsFormDto } from 'src/contacts/dto';
import { CustomContactParams } from 'src/external-services/mailjet/mailjet.types';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { ContactCandidateFormDto } from './dto/contact-candidate-form.dto';

@Injectable()
export class ContactsService {
  constructor(
    private mailsService: MailsService,
    private salesforceService: SalesforceService,
    private queuesService: QueuesService
  ) {}

  async sendContactToMailjet(contact: CustomContactParams) {
    await this.queuesService.addToWorkQueue(
      Jobs.NEWSLETTER_SUBSCRIPTION,
      contact
    );
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

  async sendContactUsMail(contactUsFormDto: ContactUsFormDto) {
    return this.mailsService.sendContactUsMail(contactUsFormDto);
  }

  async getCandidateCampaignsFromSF() {
    if (process.env.ENABLE_SF === 'true') {
      return this.salesforceService.getCandidateCampaigns();
    }
  }

  async getCoachCampaignsFromSF() {
    if (process.env.ENABLE_SF === 'true') {
      return this.salesforceService.getCoachCampaigns();
    }
  }
}
