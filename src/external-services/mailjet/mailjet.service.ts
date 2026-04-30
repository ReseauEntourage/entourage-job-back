import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import Mailjet, { Client, SendEmailV3_1 } from 'node-mailjet';
import { Departments } from 'src/common/locations/locations.types';
import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import { Genders, UserRoles } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';

import {
  ContactStatuses,
  CustomContactParams,
  CustomMailParams,
  MailjetAntenneByZone,
  MailjetContactPropertyNames,
  MailjetContactSource,
  MailjetCreateContactDto,
  MailjetListActions,
  MailjetOptions,
} from './mailjet.types';
import { createMail } from './mailjet.utils';

@Injectable()
export class MailjetService {
  private readonly logger = new Logger(MailjetService.name);

  private mailjetTransactional: Client | null = null;
  private mailjetNewsletter: Client | null = null;
  private mailjetTransactionalProxy: Client | null = null;
  private mailjetNewsletterProxy: Client | null = null;

  constructor(@InjectModel(User) private userModel: typeof User) {
    if (!process.env.MAILJET_PUB || !process.env.MAILJET_SEC) {
      throw new Error('Mailjet transactional API keys are not set');
    }
    this.mailjetTransactional = Mailjet.apiConnect(
      process.env.MAILJET_PUB,
      process.env.MAILJET_SEC
    );

    if (
      !process.env.MAILJET_NEWSLETTER_PUB ||
      !process.env.MAILJET_NEWSLETTER_SEC
    ) {
      throw new Error('Mailjet newsletter API keys are not set');
    }
    this.mailjetNewsletter = Mailjet.apiConnect(
      process.env.MAILJET_NEWSLETTER_PUB,
      process.env.MAILJET_NEWSLETTER_SEC
    );

    const proxyOptions = this.buildProxyOptions();
    if (proxyOptions) {
      this.mailjetTransactionalProxy = Mailjet.apiConnect(
        process.env.MAILJET_PUB,
        process.env.MAILJET_SEC,
        { options: proxyOptions }
      );
      this.mailjetNewsletterProxy = Mailjet.apiConnect(
        process.env.MAILJET_NEWSLETTER_PUB,
        process.env.MAILJET_NEWSLETTER_SEC,
        { options: proxyOptions }
      );
    }
  }

  private buildProxyOptions(): Record<string, unknown> | null {
    const fixieUrl = process.env.FIXIE_URL;
    if (!fixieUrl) return null;

    const url = new URL(fixieUrl);
    return {
      proxy: {
        protocol: url.protocol.replace(':', ''),
        host: url.hostname,
        port: parseInt(url.port, 10),
        ...(url.username && {
          auth: { username: url.username, password: url.password },
        }),
      },
    };
  }

  private isConnectionError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'ECONNRESET'
    );
  }

  async sendMail(params: CustomMailParams | CustomMailParams[]) {
    const mailjetParams: SendEmailV3_1.Body = { Messages: [] };
    if (Array.isArray(params)) {
      mailjetParams.Messages = params.map((p) => {
        return createMail(p);
      });
    } else {
      mailjetParams.Messages = [createMail(params)];
    }

    try {
      return await this.mailjetTransactional
        .post('send', MailjetOptions.MAILS)
        .request(mailjetParams);
    } catch (error) {
      if (this.isConnectionError(error) && this.mailjetTransactionalProxy) {
        this.logger.warn('sendMail: ECONNRESET, retrying via Fixie proxy');
        try {
          return await this.mailjetTransactionalProxy
            .post('send', MailjetOptions.MAILS)
            .request(mailjetParams);
        } catch (proxyError) {
          this.logger.error(proxyError);
          throw proxyError;
        }
      }
    }
  }

  /**
   * Adds a contact to the Mailjet newsletter list with minimal properties.
   * Used by the landing-page newsletter subscription endpoint.
   */
  async createContact(params: CustomContactParams): Promise<void> {
    const listId = parseInt(process.env.MAILJET_NEWSLETTER_LIST_ID, 10);
    if (!listId) {
      this.logger.warn(
        'MAILJET_NEWSLETTER_LIST_ID is not set — skipping createContact'
      );
      return;
    }

    const antenne = params.zone
      ? MailjetAntenneByZone[params.zone] ?? null
      : null;
    const properties: Record<string, string> = {
      [MailjetContactPropertyNames.PROGRAM]: 'Entourage Pro',
      [MailjetContactPropertyNames.SOURCE]: params.source,
    };
    if (antenne) {
      properties[MailjetContactPropertyNames.LOCAL_BRANCH] = antenne;
    }
    if (params.status === ContactStatuses.CANDIDATE) {
      properties[MailjetContactPropertyNames.IS_CANDIDATE] = 'Oui';
    } else if (params.status === ContactStatuses.COMPANY) {
      properties[MailjetContactPropertyNames.IS_COMPANY] = 'Oui';
    } else if (params.status === ContactStatuses.ASSOCIATION) {
      properties[MailjetContactPropertyNames.IS_ORGANIZATION] = 'Oui';
    }
    const body = {
      Email: params.email,
      Action: MailjetListActions.NO_FORCE,
      ...(Object.keys(properties).length > 0 && { Properties: properties }),
    };

    this.logger.log(
      `Creating Mailjet contact for email ${
        params.email
      } in list ${listId} — body: ${JSON.stringify(body)}`
    );
    try {
      const res = await this.mailjetNewsletter
        .post('contactslist', MailjetOptions.CONTACTS)
        .id(listId)
        .action('managecontact')
        .request(body);
      this.logger.log(
        `Mailjet contact created in ${listId} for email ${params.email} — status ${res.response.status}`
      );
    } catch (error) {
      if (this.isConnectionError(error) && this.mailjetNewsletterProxy) {
        this.logger.warn('createContact: ECONNRESET, retrying via Fixie proxy');
        try {
          await this.mailjetNewsletterProxy
            .post('contactslist', MailjetOptions.CONTACTS)
            .id(listId)
            .action('managecontact')
            .request(body);
        } catch (proxyError) {
          this.logger.error(proxyError);
          throw proxyError;
        }
      } else {
        this.logger.error(
          `Failed to create Mailjet contact for email ${params.email}`,
          error
        );
      }
    }
  }

  /**
   * Fetches the user by ID, builds a rich contact DTO, and creates the contact
   * in the Mailjet newsletter list with all required properties.
   */
  async createContactForUser(
    userId: string,
    source: MailjetContactSource
  ): Promise<void> {
    const listId = parseInt(process.env.MAILJET_NEWSLETTER_LIST_ID, 10);
    if (!listId) {
      this.logger.warn(
        'MAILJET_NEWSLETTER_LIST_ID is not set — skipping createContactForUser'
      );
      return;
    }

    const user = await this.userModel.findOne({
      where: { id: userId },
      include: [{ model: UserProfile }, { association: 'companies' }],
    });

    if (!user) {
      this.logger.error(`createContactForUser: user ${userId} not found`);
      throw new Error(`User ${userId} not found`);
    }

    const dto = this.buildContactDto(user, source);

    try {
      await this.mailjetNewsletter
        .post('contactslist', MailjetOptions.CONTACTS)
        .id(listId)
        .action('managecontact')
        .request({
          Email: dto.email,
          Name: `${dto.firstName} ${dto.lastName}`,
          Action: MailjetListActions.NO_FORCE,
          Properties: {
            [MailjetContactPropertyNames.CIVILITY]: dto.civility,
            [MailjetContactPropertyNames.FIRSTNAME]: dto.firstName,
            [MailjetContactPropertyNames.LASTNAME]: dto.lastName,
            [MailjetContactPropertyNames.POSTAL_CODE]: dto.postalCode,
            [MailjetContactPropertyNames.LOCAL_BRANCH]: dto.antenne,
            [MailjetContactPropertyNames.PROGRAM]: dto.program,
            [MailjetContactPropertyNames.IS_CANDIDATE]: dto.isCandidate
              ? 'Oui'
              : '',
            [MailjetContactPropertyNames.IS_COACH]: dto.isCoach ? 'Oui' : '',
            [MailjetContactPropertyNames.IS_PRECA]: dto.isPreca ? 'Oui' : '',
            [MailjetContactPropertyNames.IS_VOLUNTEER]: dto.isVolunteer
              ? 'Oui'
              : '',
            [MailjetContactPropertyNames.IS_COMPANY]: dto.isCompany
              ? 'Oui'
              : '',
            [MailjetContactPropertyNames.IS_ORGANIZATION]: dto.isOrganization
              ? 'Oui'
              : '',
            [MailjetContactPropertyNames.SOURCE]: dto.source,
          },
        });

      this.logger.log(`Contact ${userId} successfully created in Mailjet`);
    } catch (error) {
      this.logger.error(`Failed to create contact ${userId} in Mailjet`, error);
      throw error;
    }
  }

  /**
   * Maps a User entity to the MailjetCreateContactDto.
   */
  private buildContactDto(
    user: User,
    source: MailjetContactSource
  ): MailjetCreateContactDto {
    const civility =
      user.gender === Genders.MALE
        ? 'Monsieur'
        : user.gender === Genders.FEMALE
        ? 'Madame'
        : null;

    // Extract department code from strings like "Paris (75)" → "75"
    const userProfile = user.userProfile;
    const postalCode = userProfile?.department
      ? userProfile.department.match(/\((\d+)\)/)?.[1] ?? null
      : null;

    // Derive zone from the user's department for accurate antenne mapping —
    // avoids returning null for HZ users who still have a known department.
    const departmentZone = userProfile?.department
      ? Departments.find((d) => d.name === userProfile.department)?.zone ?? null
      : null;
    const zone = (departmentZone ?? user.zone ?? null) as ZoneName | null;
    const antenne = zone ? MailjetAntenneByZone[zone] ?? null : null;

    return {
      email: user.email,
      civility,
      firstName: user.firstName,
      lastName: user.lastName,
      postalCode,
      antenne,
      program: 'Entourage Pro',
      isCandidate: user.role === UserRoles.CANDIDATE,
      isCoach: user.role === UserRoles.COACH,
      isPreca: false,
      isVolunteer: false,
      isCompany: (user.companies?.length ?? 0) > 0,
      isOrganization: !!user.OrganizationId,
      source,
    };
  }
}
