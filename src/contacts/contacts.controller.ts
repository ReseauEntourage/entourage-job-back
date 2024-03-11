import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import validator from 'validator';
import { Public } from 'src/auth/guards';
import {
  ContactCompanyFormDto,
  ContactCompanyFormPipe,
  ContactUsFormDto,
  ContactUsFormPipe,
} from 'src/contacts/dto';
import { ContactStatus } from 'src/external-services/mailjet/mailjet.types';
import { isValidPhone } from 'src/utils/misc';
import { AdminZone } from 'src/utils/types';
import { ContactsService } from './contacts.service';
import { ContactCandidateFormDto } from './dto/contact-candidate-form.dto';
import { ContactCandidateFormPipe } from './dto/contact-candidate-form.pipe';
import { InscriptionCandidateFormDto } from './dto/inscription-candidate-form.dto';
import { InscriptionCandidateFormPipe } from './dto/inscription-candidate-form.pipe';

// TODO change to /contacts
@Throttle(20, 60)
@Controller('contact')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Public()
  @Post('contactUs')
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
  async sendCompanyForm(
    @Body(new ContactCompanyFormPipe())
    contactCompanyFormDto: ContactCompanyFormDto
  ) {
    if (
      contactCompanyFormDto.phone &&
      !isValidPhone(contactCompanyFormDto.phone)
    ) {
      throw new BadRequestException();
    }

    return this.contactsService.sendCompanyContactToSalesforce(
      contactCompanyFormDto
    );
  }

  @Public()
  @Post('candidate')
  async sendCandidateForm(
    @Body(new ContactCandidateFormPipe())
    contactCandidateFormDto: ContactCandidateFormDto
  ) {
    if (
      !isValidPhone(contactCandidateFormDto.phone) ||
      !isValidPhone(contactCandidateFormDto.workerPhone)
    ) {
      throw new BadRequestException();
    }

    return this.contactsService.sendCandidateContactToSalesforce(
      contactCandidateFormDto
    );
  }

  @Public()
  @Post('newsletter')
  async addContactForNewsletter(
    @Body('email') email: string,
    @Body('zone') zone?: AdminZone,
    @Body('status') status?: ContactStatus
  ) {
    if (!email || !validator.isEmail(email)) {
      throw new BadRequestException();
    }

    return this.contactsService.sendContactToMailjet({
      email,
      zone,
      status,
    });
  }

  @Public()
  @Get('campaigns/candidate')
  async getCandidateCampaigns() {
    return this.contactsService.getCandidateCampaignsFromSF();
  }

  @Public()
  @Get('campaigns/coach')
  async getCoachCampaigns() {
    return this.contactsService.getCoachCampaignsFromSF();
  }

  @Public()
  @Post('candidateInscription')
  async candidateInscription(
    @Body(new InscriptionCandidateFormPipe())
    inscriptionCandidateFormDto: InscriptionCandidateFormDto
  ) {
    if (!isValidPhone(inscriptionCandidateFormDto.phone)) {
      throw new BadRequestException('invalid phone');
    }
    return this.contactsService.sendCandidateInscriptionToSalesforce(
      inscriptionCandidateFormDto
    );
  }
}
