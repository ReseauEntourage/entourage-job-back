import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import Mailjet, { Client, SendEmailV3_1 } from 'node-mailjet';
import { Departments } from 'src/locations/locations.types';
import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import { Genders, UserRoles } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';

import { MailjetRelayClient, MailjetRelayResult } from './mailjet-relay.client';
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
  /**
   * Set when MAILJET_RELAY_URL is defined: every Mailjet request then goes
   * through the relay lambda instead of calling Mailjet directly.
   */
  private relayClient: MailjetRelayClient | null = null;

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

    const relayUrl = process.env.MAILJET_RELAY_URL;
    if (relayUrl) {
      if (!process.env.MAILJET_RELAY_SECRET) {
        throw new Error(
          'MAILJET_RELAY_SECRET is not set (required when MAILJET_RELAY_URL is set)'
        );
      }
      this.relayClient = new MailjetRelayClient(
        relayUrl,
        process.env.MAILJET_RELAY_SECRET
      );
      this.logger.log('Mailjet requests are sent through the relay');
    }
  }

  /** Extracts a stack trace for `Logger#error`'s trace param, when available. */
  private errorStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  }

  /**
   * node-mailjet flattens the API's error body onto the thrown Error (see
   * node_modules/node-mailjet Request#request), but the per-message detail
   * that actually names the offending field (ErrorRelatedTo) only lives
   * under `response.data.Messages[].Errors`, one level deeper than what
   * `error.message` already contains — surface all of it so a 400 like
   * "Property value cannot be null" is actionable without re-triggering it.
   */
  private describeMailjetError(error: unknown): Record<string, unknown> {
    if (typeof error !== 'object' || error === null) {
      return { raw: String(error) };
    }
    const err = error as {
      ErrorCode?: string;
      ErrorIdentifier?: string;
      ErrorMessage?: string;
      ErrorRelatedTo?: string[];
      message?: string;
      response?: { data?: unknown };
      source?: string;
      statusCode?: number;
    };
    return {
      source: err.source ?? null,
      statusCode: err.statusCode ?? null,
      message: err.message ?? null,
      errorCode: err.ErrorCode ?? null,
      errorIdentifier: err.ErrorIdentifier ?? null,
      errorMessage: err.ErrorMessage ?? null,
      errorRelatedTo: err.ErrorRelatedTo ?? null,
      // Raw response body — contains Messages[].Errors[].ErrorRelatedTo,
      // which names the exact property Mailjet rejected.
      responseBody: err.response?.data ?? null,
    };
  }

  // Variable keys carrying auth secrets (password reset / email verification
  // tokens, OTP codes) — never write their value to logs.
  private static readonly SENSITIVE_VARIABLE_KEYS = new Set([
    'token',
    'otpCode',
  ]);

  private redactSensitiveVariables(
    variables: Record<string, unknown> | undefined
  ): Record<string, unknown> | undefined {
    if (!variables) {
      return variables;
    }
    return Object.fromEntries(
      Object.entries(variables).map(([key, value]) =>
        MailjetService.SENSITIVE_VARIABLE_KEYS.has(key)
          ? [key, '[REDACTED]']
          : [key, value]
      )
    );
  }

  /** Summarizes the outgoing request so a failure can be traced back to a recipient/template. */
  private describeMailjetRequest(mailjetParams: SendEmailV3_1.Body) {
    return mailjetParams.Messages.map((m) => ({
      to: m.To?.map((r) => r.Email),
      cc: m.Cc?.map((r) => r.Email),
      templateId: m.TemplateID,
      variables: this.redactSensitiveVariables(
        m.Variables as Record<string, unknown> | undefined
      ),
    }));
  }

  /**
   * Says where a failure comes from, so that a relay rejection (e.g. a wrong
   * relay secret) is never mistaken for a Mailjet rejection (e.g. invalid
   * API keys). Errors thrown by node-mailjet carry no `source`.
   */
  private describeFailureOrigin(error: unknown): string {
    const source = (error as { source?: string } | null)?.source;
    switch (source) {
      case 'mailjet':
        return 'Mailjet rejected the request';
      case 'relay':
        return 'the Mailjet relay rejected the request';
      case 'network':
        return 'the Mailjet relay could not be reached';
      default:
        return 'direct call to Mailjet failed';
    }
  }

  /** Sends a transactional body through the relay when configured, directly otherwise. */
  private postSend(body: SendEmailV3_1.Body) {
    if (this.relayClient) {
      return this.relayClient.send(body);
    }
    return this.mailjetTransactional
      .post('send', MailjetOptions.MAILS)
      .request(body);
  }

  /** Adds or updates a contact in a list through the relay when configured, directly otherwise. */
  private postContact(
    listId: number,
    body: Record<string, unknown>
  ): Promise<MailjetRelayResult | { response: { status: number } }> {
    if (this.relayClient) {
      return this.relayClient.manageContact(listId, body);
    }
    return this.mailjetNewsletter
      .post('contactslist', MailjetOptions.CONTACTS)
      .id(listId)
      .action('managecontact')
      .request(body);
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
      return await this.postSend(mailjetParams);
    } catch (error) {
      this.logger.error(
        `sendMail failed (${this.describeFailureOrigin(
          error
        )}) — request: ${JSON.stringify(
          this.describeMailjetRequest(mailjetParams)
        )} — error: ${JSON.stringify(this.describeMailjetError(error))}`,
        this.errorStack(error)
      );
      throw error;
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
      ? (MailjetAntenneByZone[params.zone] ?? null)
      : null;
    const properties: Record<string, string> = {
      [MailjetContactPropertyNames.PROGRAM]: 'Entourage Pro',
      [MailjetContactPropertyNames.SOURCE]: params.source,
      [MailjetContactPropertyNames.IS_CANDIDATE]:
        params.status === ContactStatuses.CANDIDATE ? 'Oui' : 'Non',
      [MailjetContactPropertyNames.IS_COMPANY]:
        params.status === ContactStatuses.COMPANY ? 'Oui' : 'Non',
      [MailjetContactPropertyNames.IS_ORGANIZATION]:
        params.status === ContactStatuses.ASSOCIATION ? 'Oui' : 'Non',
    };
    if (antenne) {
      properties[MailjetContactPropertyNames.LOCAL_BRANCH] = antenne;
    }
    const body = {
      Email: params.email,
      Action: MailjetListActions.NO_FORCE,
      ...(Object.keys(properties).length > 0 && { Properties: properties }),
    };

    this.logger.log(
      `Creating Mailjet contact for email ${params.email} in list ${listId}}`
    );
    try {
      const res = await this.postContact(listId, body);
      this.logger.log(
        `Mailjet contact created in ${listId} for email ${params.email} — status ${res.response.status}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to create Mailjet contact for email ${
          params.email
        } (${this.describeFailureOrigin(error)}) — error: ${JSON.stringify(
          this.describeMailjetError(error)
        )}`,
        this.errorStack(error)
      );
      throw error;
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

    const body = {
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
          : 'Non',
        [MailjetContactPropertyNames.IS_COACH]: dto.isCoach ? 'Oui' : 'Non',
        [MailjetContactPropertyNames.IS_PRECA]: dto.isPreca ? 'Oui' : 'Non',
        [MailjetContactPropertyNames.IS_VOLUNTEER]: dto.isVolunteer
          ? 'Oui'
          : 'Non',
        [MailjetContactPropertyNames.IS_COMPANY]: dto.isCompany ? 'Oui' : 'Non',
        [MailjetContactPropertyNames.IS_ORGANIZATION]: dto.isOrganization
          ? 'Oui'
          : 'Non',
        [MailjetContactPropertyNames.SOURCE]: dto.source,
      },
    };

    try {
      await this.postContact(listId, body);
      this.logger.log(`Contact ${userId} successfully created in Mailjet`);
    } catch (error) {
      this.logger.error(
        `Failed to create contact ${userId} in Mailjet (${this.describeFailureOrigin(
          error
        )}) — error: ${JSON.stringify(this.describeMailjetError(error))}`,
        this.errorStack(error)
      );
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
        ? 'M'
        : user.gender === Genders.FEMALE
          ? 'Mme'
          : null;

    // Extract department code from strings like "Paris (75)" → "75"
    const userProfile = user.userProfile;
    const postalCode = userProfile?.department
      ? (userProfile.department.match(/\((\d+)\)/)?.[1] ?? null)
      : null;

    // Derive zone from the user's department for accurate antenne mapping —
    // avoids returning null for HZ users who still have a known department.
    const departmentZone = userProfile?.department
      ? (Departments.find((d) => d.name === userProfile.department)?.zone ??
        null)
      : null;
    const zone = (departmentZone ?? user.zone ?? null) as ZoneName | null;
    const antenne = zone ? (MailjetAntenneByZone[zone] ?? null) : null;

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
