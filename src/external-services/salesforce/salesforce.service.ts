import { Injectable, Logger } from '@nestjs/common';
import * as jsforce from 'jsforce';
import { Connection, ErrorResult, SuccessResult } from 'jsforce';
import moment from 'moment-timezone';

import {
  CandidateAccommodation,
  CandidateGender,
  CandidateResource,
  CandidateYesNoNSPPValue,
  JobSearchDuration,
  Nationality,
  StudiesLevel,
  WorkingExperience,
  YesNoJNSPRValue,
} from 'src/contacts/contacts.types';
import {
  EventMode,
  EventPublicAudience,
  EventType,
} from 'src/events/event.types';
import {
  eventTypeToSalesforceEventType,
  salesforceEventAttributes,
} from 'src/events/events.utils';
import { SlackService } from 'src/external-services/slack/slack.service';
import { UsersService } from 'src/users/users.service';
import { RegistrableUserRole, UserRoles } from 'src/users/users.types';
import { SfLocalBranchName } from 'src/utils/types/local-branches.types';
import {
  AccountProps,
  AccountRecordType,
  AccountRecordTypesIds,
  CompanyLeadProps,
  ContactProps,
  ContactRecordType,
  ErrorCodes,
  LeadProp,
  LeadRecordType,
  LeadRecordTypesIds,
  ObjectName,
  ObjectNames,
  Casquette,
  SalesforceAccount,
  SalesforceBinome,
  SalesforceCampaign,
  SalesforceCampaignMember,
  SalesforceError,
  SalesforceLead,
  SalesforceObject,
  SalesforceTask,
  UserProps,
  SalesforceCampaignStatus,
} from './salesforce.types';

import {
  addToSalesforceMultiPicklist,
  determineContactRecordType,
  escapeQuery,
  executeBulkAction,
  formatBusinessSectors,
  formatCompanyName,
  formatDepartment,
  getCasquette,
  getPostalCodeFromDepartment,
  mapSalesforceContactFields,
  mapSalesforceContactSocialSituationFields,
  mapSalesforceLeadFields,
  parseAddress,
  parseSalesforceMultiPicklist,
  prependDuplicateIfCondition,
} from './salesforce.utils';

const RETRY_DELAY = 60 * 10;
const RETRY_NUMBER = 5;

const REGEX_ESCAPE = /[?&|!{}[\]()^~*:\\"'+-]/gi;

type SalesforceContactLookup = {
  Casquettes_r_les__c: string;
  Id: string;
  Reseaux__c?: string;
};

/**
 * Shape of a Contact candidate as read by the `salesforce-contact-id-backfill` job (see
 * findContactsByEmailForBackfill / completeContactNetworkAndCasquette).
 */
export type SalesforceBackfillCandidate = {
  Casquettes_r_les__c?: string;
  ID_App_Entourage_Pro__c?: string;
  Id: string;
  Reseaux__c?: string;
};

const asyncTimeout = (delay: number) =>
  new Promise<void>((res) => {
    setTimeout(() => {
      res();
    }, delay * 1000);
  });

@Injectable()
export class SalesforceService {
  private readonly logger = new Logger(SalesforceService.name);
  private salesforce: Connection;
  private isWorker = true;

  constructor(
    private usersService: UsersService,
    private slackService: SlackService
  ) {}

  setIsWorker(isWorker: boolean) {
    this.isWorker = isWorker;
  }

  async loginToSalesforce() {
    const tokenUrl = `${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SALESFORCE_CLIENT_ID,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce authentication failed: ${error}`);
    }

    const { access_token, instance_url } = (await response.json()) as {
      access_token: string;
      instance_url: string;
    };

    this.salesforce = new jsforce.Connection({
      instanceUrl: instance_url,
      accessToken: access_token,
      maxRequest: 10000,
      version: '43.0',
    });
  }

  async checkIfConnected() {
    try {
      await this.salesforce.query('SELECT Id FROM User LIMIT 1');
    } catch {
      await this.refreshSalesforceInstance();
    }
  }

  async refreshSalesforceInstance(retries?: number) {
    const remainingRetries = retries || retries === 0 ? retries : RETRY_NUMBER;
    try {
      await this.loginToSalesforce();
    } catch (err) {
      console.error(
        `Error after trying to log in '${(err as SalesforceError).message}'`
      );
      // eslint-disable-next-line no-console
      console.log('Salesforce auth retries', remainingRetries);
      if (this.isWorker && remainingRetries > 0) {
        await asyncTimeout(RETRY_DELAY);
        await this.refreshSalesforceInstance(remainingRetries - 1);
      } else {
        throw err;
      }
    }
  }

  async createRecord<T extends ObjectName, K extends LeadRecordType>(
    name: T,
    params: SalesforceObject<T, K> | SalesforceObject<T, K>[]
  ): Promise<string | string[]> {
    await this.checkIfConnected();

    try {
      if (Array.isArray(params)) {
        const job = this.salesforce.bulk.createJob(name, 'insert');

        const results = await executeBulkAction<T>(params, job);

        let resultsIds: string[] = [];

        for (let i = 0; i < results.length; i += 1) {
          const { id, success, errors } = results[i] as ErrorResult &
            SuccessResult;
          if (!success) {
            console.error(`Error creating Salesforce records : `, errors);
          } else {
            resultsIds = [...resultsIds, id];
          }
        }

        return resultsIds;
      } else {
        const result = await this.salesforce.sobject(name).insert(params);
        if (!result.success) {
          throw (result as ErrorResult).errors;
        }
        return (result as SuccessResult).id;
      }
    } catch (err) {
      if (
        (err as SalesforceError).errorCode === ErrorCodes.DUPLICATES_DETECTED
      ) {
        return (err as SalesforceError).duplicateResult.matchResults[0]
          .matchRecords[0].record.Id;
      }
      console.error(err);
      throw err;
    }
  }

  async updateRecord<T extends ObjectName, K extends LeadRecordType>(
    name: T,
    params: Partial<SalesforceObject<T, K> | SalesforceObject<T, K>[]>
  ): Promise<string | string[]> {
    await this.checkIfConnected();

    try {
      if (Array.isArray(params)) {
        const job = this.salesforce.bulk.createJob(name, 'update');

        const results = await executeBulkAction<T>(params, job);

        let resultsIds: string[] = [];

        for (let i = 0; i < results.length; i += 1) {
          const { id, success, errors } = results[i] as ErrorResult &
            SuccessResult;
          if (!success) {
            console.error(`Error updating Salesforce records : `, errors);
          } else {
            resultsIds = [...resultsIds, id];
          }
        }

        return resultsIds;
      } else {
        const result = await this.salesforce.sobject(name).update(params);
        if (!result.success) {
          throw (result as ErrorResult).errors;
        }
        return (result as SuccessResult).id;
      }
    } catch (err) {
      if (
        (err as SalesforceError).errorCode === ErrorCodes.DUPLICATES_DETECTED
      ) {
        return (err as SalesforceError).duplicateResult.matchResults[0]
          .matchRecords[0].record.Id;
      }
      if (
        (err as SalesforceError).errorCode ===
        ErrorCodes.CANNOT_UPDATE_CONVERTED_LEAD
      ) {
        if (Array.isArray(params)) {
          return params.map(({ Id }) => Id);
        }
        return params.Id;
      }
      console.error(err);
      throw err;
    }
  }

  async upsertRecord<T extends ObjectName>(
    name: T,
    params: SalesforceObject<T> | SalesforceObject<T>[],
    extIdField: keyof SalesforceObject<T>,
    findIdFunction: 'findTaskById'
  ): Promise<string | string[]> {
    await this.checkIfConnected();

    try {
      if (Array.isArray(params)) {
        const job = this.salesforce.bulk.createJob(name, 'upsert', {
          extIdField: extIdField as string,
        });

        const results = await executeBulkAction<T>(params, job);

        let resultsIds: string[] = [];

        for (let i = 0; i < results.length; i += 1) {
          const { id, success, errors } = results[i] as ErrorResult &
            SuccessResult;
          if (!success) {
            console.error(`Error upserting Salesforce records : `, errors);
          } else {
            resultsIds = [
              ...resultsIds,
              id ||
                (await this[findIdFunction](
                  (params as SalesforceObject<T>[])[i][extIdField]
                )),
            ];
          }
        }

        return resultsIds;
      } else {
        const result = await this.salesforce
          .sobject(name)
          .upsert(params, extIdField as string);
        if (!result.success) {
          throw (result as ErrorResult).errors;
        }
        return (
          (result as SuccessResult).id ||
          (await this[findIdFunction](
            (params as SalesforceObject<T>)[extIdField]
          ))
        );
      }
    } catch (err) {
      if (
        (err as SalesforceError).errorCode === ErrorCodes.DUPLICATES_DETECTED
      ) {
        return (err as SalesforceError).duplicateResult.matchResults[0]
          .matchRecords[0].record.Id;
      }
      console.error(err);
      throw err;
    }
  }

  async searchAccountByName(search: string, recordType: AccountRecordType) {
    const escapedSearch = search.replace(REGEX_ESCAPE, '\\$&');
    await this.checkIfConnected();
    if (escapedSearch.length === 1) {
      const { records }: { records: Partial<SalesforceAccount>[] } =
        await this.salesforce.query(
          `SELECT Id
           FROM ${ObjectNames.ACCOUNT}
           WHERE Name LIKE '${escapedSearch}%'
             AND RecordTypeId = '${recordType}' LIMIT 1`
        );
      return records[0]?.Id;
    }

    const { searchRecords } = await this.salesforce.search(
      `FIND {${escapedSearch}} IN NAME FIELDS RETURNING ${ObjectNames.ACCOUNT}(Id) LIMIT 1`
    );

    return searchRecords[0]?.Id;
  }

  async searchAccount(search: string) {
    const escapedSearch = search.replace(REGEX_ESCAPE, '\\$&');
    await this.checkIfConnected();

    const { searchRecords } = await this.salesforce.search(
      `FIND {${escapedSearch}} RETURNING ${ObjectNames.ACCOUNT}(Id) LIMIT 1`
    );

    return searchRecords[0]?.Id;
  }

  /**
   * Finds the Salesforce Contact of a Pro user.
   *
   * Resolution order:
   * 1. If `appId` is provided, lookup by `ID_App_Entourage_Pro__c` (stable application id,
   *    resilient to the email being changed by a third-party Salesforce workflow).
   * 2. Fallback to a lookup by `Email`. If that fallback finds a contact and `appId` is
   *    provided, `ID_App_Entourage_Pro__c` is repaired when empty, or left untouched (with a
   *    Datadog warning + Slack alert) when it already points to a *different* app id - the
   *    contact of another Pro user must never be silently reattributed.
   */
  async findContact(
    email: string,
    recordType?: ContactRecordType,
    appId?: string
  ): Promise<{
    Casquettes_r_les__c: Casquette[];
    Id: string;
    Reseaux__c: string[];
  } | null> {
    await this.checkIfConnected();

    if (appId) {
      const { records: appIdRecords }: { records: SalesforceContactLookup[] } =
        await this.salesforce.query(
          `SELECT Id, Casquettes_r_les__c, Reseaux__c, AccountId
           FROM ${ObjectNames.CONTACT}
           WHERE ID_App_Entourage_Pro__c = '${escapeQuery(appId)}' ${
             recordType ? `AND RecordTypeId = '${recordType}'` : ''
           } LIMIT 1`
        );
      if (appIdRecords[0]) {
        await this.syncUserSfContactId(appId, appIdRecords[0].Id);
        return this.mapFindContactRecord(appIdRecords[0]);
      }
    }

    const sfEmail = email.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const {
      records,
    }: {
      records: (SalesforceContactLookup & {
        ID_App_Entourage_Pro__c?: string;
      })[];
    } = await this.salesforce.query(
      `SELECT Id, Casquettes_r_les__c, Reseaux__c, AccountId, ID_App_Entourage_Pro__c
       FROM ${ObjectNames.CONTACT}
       WHERE Email = '${escapeQuery(sfEmail)}' ${
         recordType ? `AND RecordTypeId = '${recordType}'` : ''
       } LIMIT 1`
    );
    const record = records[0];
    if (!record) {
      return null;
    }

    if (appId) {
      const linkedToCurrentUser = await this.repairOrGuardAppId(
        record,
        appId,
        sfEmail
      );
      if (linkedToCurrentUser) {
        await this.syncUserSfContactId(appId, record.Id);
      }
    }

    return this.mapFindContactRecord(record);
  }

  /**
   * Mirrors the linked Salesforce Contact Id on the User row (see
   * salesforce-contact-identity-resolution capability), so it's readable from Entourage Pro
   * without a round-trip to Salesforce. Non-fatal: a Postgres write failure here must not break
   * the Salesforce contact resolution it's piggy-backing on.
   */
  private async syncUserSfContactId(
    userId: string,
    contactId: string
  ): Promise<void> {
    try {
      await this.usersService.updateSfContactId(userId, contactId);
    } catch (error) {
      this.logger.warn(
        `Failed to mirror sfContactId (${contactId}) on user ${userId}`,
        error
      );
    }
  }

  private mapFindContactRecord(record: {
    Casquettes_r_les__c: string;
    Id: string;
    Reseaux__c?: string;
  }): { Casquettes_r_les__c: Casquette[]; Id: string; Reseaux__c: string[] } {
    return {
      Id: record.Id,
      Casquettes_r_les__c: parseSalesforceMultiPicklist(
        record.Casquettes_r_les__c
      ) as Casquette[],
      Reseaux__c: parseSalesforceMultiPicklist(record.Reseaux__c),
    };
  }

  /**
   * Applies the repair/guard-rail logic (see design.md § Decision 2) once a contact has been
   * found via the email fallback and an appId is known for the current user.
   *
   * @returns whether this contact is (now) safely linked to the current user - false for the
   * guard-rail case, where it belongs to someone else and must not be treated as linked.
   */
  private async repairOrGuardAppId(
    record: { Id: string; ID_App_Entourage_Pro__c?: string },
    appId: string,
    sfEmail: string
  ): Promise<boolean> {
    const existingAppId = record.ID_App_Entourage_Pro__c;

    if (!existingAppId) {
      await this.updateRecord(ObjectNames.CONTACT, {
        Id: record.Id,
        ID_App_Entourage_Pro__c: appId,
      });
      return true;
    }

    if (existingAppId === appId) {
      return true;
    }

    this.logger.warn(
      `Salesforce contact ${record.Id} found by email '${sfEmail}' is already linked to a different app id (${existingAppId}) than the current user (${appId}) - not overwriting`
    );
    await this.slackService.sendTechnicalMonitoringMessage(
      false,
      '⚠️ Contact Salesforce partagé entre deux utilisateurs Pro',
      [
        { title: 'Utilisateur courant', content: appId },
        { title: 'Email en cause', content: sfEmail },
        {
          title: 'Contact déjà lié à',
          content: existingAppId,
        },
      ]
    );
    return false;
  }

  /**
   * Lookup used by the `salesforce-contact-id-backfill` job only: returns every Contact
   * candidate matching an email (not just the first one), without repairing or alerting -
   * the backfill classifies candidates itself and reports them in aggregate at the end of its
   * run rather than firing one Slack alert per ambiguous case (see design.md § Decision 3).
   */
  async findContactsByEmailForBackfill(
    email: string
  ): Promise<SalesforceBackfillCandidate[]> {
    await this.checkIfConnected();
    const sfEmail = email.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const { records }: { records: SalesforceBackfillCandidate[] } =
      await this.salesforce.query(
        `SELECT Id, ID_App_Entourage_Pro__c, Reseaux__c, Casquettes_r_les__c
         FROM ${ObjectNames.CONTACT}
         WHERE Email = '${escapeQuery(sfEmail)}'`
      );
    return records;
  }

  /**
   * Writes `ID_App_Entourage_Pro__c` on a single Contact already resolved as a safe,
   * unambiguous correction by the backfill job. Never creates a Contact.
   */
  async repairContactAppId(contactId: string, appId: string): Promise<void> {
    await this.updateRecord(ObjectNames.CONTACT, {
      Id: contactId,
      ID_App_Entourage_Pro__c: appId,
    });
    await this.syncUserSfContactId(appId, contactId);
  }

  /**
   * Adds the `LinkedOut` network and/or the role's casquette to a Contact already identified
   * without ambiguity by the backfill job (safe_correction or already_linked), without ever
   * removing an existing value from either multi-picklist field. Used only by the
   * `salesforce-contact-id-backfill` job - the runtime registration flow has its own additive
   * write combined with the app id repair (see `updateContactCasquetteAndAppId`).
   */
  async completeContactNetworkAndCasquette(
    contact: SalesforceBackfillCandidate,
    casquette: Casquette | null
  ): Promise<{ networkAdded: boolean; casquetteAdded: Casquette | null }> {
    const currentReseaux = parseSalesforceMultiPicklist(contact.Reseaux__c);
    const currentCasquettes = parseSalesforceMultiPicklist(
      contact.Casquettes_r_les__c
    ) as Casquette[];

    const updatedReseaux = addToSalesforceMultiPicklist(
      currentReseaux,
      'LinkedOut'
    );
    const updatedCasquettes = casquette
      ? addToSalesforceMultiPicklist(currentCasquettes, casquette)
      : currentCasquettes;

    const networkAdded = updatedReseaux.length !== currentReseaux.length;
    const casquetteAdded =
      updatedCasquettes.length !== currentCasquettes.length ? casquette : null;

    if (!networkAdded && !casquetteAdded) {
      return { networkAdded: false, casquetteAdded: null };
    }

    await this.updateRecord(ObjectNames.CONTACT, {
      Id: contact.Id,
      ...(networkAdded ? { Reseaux__c: updatedReseaux.join(';') } : {}),
      ...(casquetteAdded
        ? { Casquettes_r_les__c: updatedCasquettes.join(';') }
        : {}),
    });
    return { networkAdded, casquetteAdded };
  }

  async findLead<T extends LeadRecordType>(email: string, recordType?: T) {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceLead<T>>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.LEAD}
         WHERE Email = '${escapeQuery(email)}' ${
           recordType ? `AND RecordTypeId = '${recordType}'` : ''
         } LIMIT 1
        `
      );
    return records[0]?.Id;
  }

  async findCompanyFromCompanyName(name: string) {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceAccount>[] } =
      await this.salesforce.query(
        `SELECT Id, Name
          FROM ${ObjectNames.ACCOUNT}
          WHERE Name = '${escapeQuery(name)}'
          AND RecordTypeId = '${AccountRecordTypesIds.COMPANY}'
          LIMIT 1
        `
      );
    return records[0] || null;
  }

  async findOwnerByLeadSfId<T extends LeadRecordType>(id: string) {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceLead<T>>[] } =
      await this.salesforce.query(
        `SELECT OwnerId
         FROM ${ObjectNames.LEAD}
         WHERE Id = '${id}' LIMIT 1
        `
      );
    return records[0]?.OwnerId;
  }

  /**
   * Find all event campaigns
   * @param limit Number of campaigns to retrieve
   * @param offset Number of campaigns to skip
   * @param search Search term to filter campaigns
   * @returns List of event campaigns
   */
  async findAllEventCampaigns(
    userEmail: string,
    limit: number,
    offset: number,
    includePastEvents: boolean,
    isParticipating: boolean | null,
    search = '',
    modes?: EventMode[],
    eventTypes?: EventType[],
    localBranches?: SfLocalBranchName[],
    publicSensibilise?: EventPublicAudience[],
    userId?: string
  ) {
    await this.checkIfConnected();

    const currentTime = moment().format('HH:mm:ss[Z]');

    // Retrieve contactId if userEmail is provided
    let contactId: string | null = null;
    if (userEmail) {
      const contact = await this.findContact(userEmail, undefined, userId);
      contactId = contact?.Id || null;
    }

    // Handle modes filter
    const modeFilters =
      modes && modes.length > 0
        ? `
              AND (
                ${modes
                  .map((mode) => {
                    if (mode === EventMode.ONLINE) {
                      return `En_Ligne__c = 'Oui'`;
                    } else if (mode === EventMode.IRL) {
                      // By default, events are considered IRL when En_Ligne__c is 'Non' or null
                      return `(En_Ligne__c = 'Non' OR En_Ligne__c = NULL)`;
                    }
                  })
                  .join(' OR ')}
              )
            `
        : '';

    // Handle event types filter
    const eventTypesFilters =
      eventTypes && eventTypes.length > 0
        ? `
              AND (
                ${eventTypes
                  .map((eventType) => {
                    const sfEventType =
                      eventTypeToSalesforceEventType[eventType];
                    return `Type_evenement__c = '${sfEventType}'`;
                  })
                  .join(' OR ')}
              )
            `
        : '';

    const searchCondition = search
      ? `AND Name LIKE '%${escapeQuery(search)}%'`
      : '';

    const localBranchesCondition =
      localBranches && localBranches.length > 0
        ? `
              AND Antenne__c INCLUDES (${localBranches
                .map((b) => `'${escapeQuery(b)}'`)
                .join(', ')})
            `
        : '';

    const publicSensibiliseFilter =
      publicSensibilise && publicSensibilise.length > 0
        ? `AND Public_sensibilis__c INCLUDES (${publicSensibilise
            .map((v) => `'${escapeQuery(v)}'`)
            .join(', ')})`
        : '';

    let isParticipatingCondition = '';
    if (contactId && isParticipating === true) {
      isParticipatingCondition = `
              AND Id IN (
                SELECT CampaignId
                FROM ${ObjectNames.CAMPAIGN_MEMBER}
                WHERE ContactId = '${escapeQuery(contactId)}'
                AND Status = '${SalesforceCampaignStatus.REGISTERED}'
              )
            `;
    } else if (contactId && isParticipating === false) {
      isParticipatingCondition = `
              AND Id NOT IN (
                SELECT CampaignId
                FROM ${ObjectNames.CAMPAIGN_MEMBER}
                WHERE ContactId = '${escapeQuery(contactId)}'
                AND Status = '${SalesforceCampaignStatus.REGISTERED}'
              )
            `;
    }
    const pastEventsCondition = includePastEvents
      ? ''
      : `AND (StartDate > TODAY OR (StartDate = TODAY AND Heure_d_but__c >= '${currentTime}'))`;

    const selectUserParticipation = contactId
      ? `, (SELECT Id FROM CampaignMembers WHERE ContactId = '${escapeQuery(
          contactId
        )}' AND Status = '${SalesforceCampaignStatus.REGISTERED}' LIMIT 1)`
      : '';
    const query = `SELECT ${salesforceEventAttributes.join(
      ', '
    )}${selectUserParticipation}
           FROM ${ObjectNames.CAMPAIGN}
           WHERE
            Type = 'Event' AND R_seaux__c INCLUDES ('LinkedOut')
            ${searchCondition}
            ${modeFilters}
            ${eventTypesFilters}
            ${localBranchesCondition}
            ${publicSensibiliseFilter}
            ${isParticipatingCondition}
            ${pastEventsCondition}
            ORDER BY StartDate ASC, Heure_d_but__c ASC
            LIMIT ${limit} OFFSET ${offset}
           `;
    const { records }: { records: Partial<SalesforceCampaign>[] } =
      await this.salesforce.query(query);
    return records;
  }

  async findEventCampaignById(
    userEmail: string,
    eventId: string,
    userId?: string
  ) {
    await this.checkIfConnected();
    // Retrieve contactId if userEmail is provided
    let contactId: string | null = null;
    if (userEmail) {
      const contact = await this.findContact(userEmail, undefined, userId);
      contactId = contact?.Id || null;
    }
    const selectUserParticipation = contactId
      ? `, (SELECT Id FROM CampaignMembers WHERE ContactId = '${escapeQuery(
          contactId
        )}' AND Status = '${SalesforceCampaignStatus.REGISTERED}' LIMIT 1)`
      : '';
    const { records }: { records: Partial<SalesforceCampaign>[] } =
      await this.salesforce.query(
        `SELECT ${salesforceEventAttributes.join(
          ', '
        )} ${selectUserParticipation}
          FROM ${ObjectNames.CAMPAIGN}
          WHERE Id = '${escapeQuery(
            eventId
          )}' AND Type = 'Event' AND R_seaux__c INCLUDES ('LinkedOut')
          LIMIT 1
        `
      );
    return (records[0] as SalesforceCampaign) || null;
  }

  async findCampaignMember(
    { leadId, contactId }: { contactId?: string; leadId?: string },
    campaignId: string
  ) {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceCampaignMember>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.CAMPAIGN_MEMBER}
         WHERE ${leadId ? `LeadId = '${leadId}'` : `ContactId = '${contactId}'`}
           AND CampaignId = '${escapeQuery(campaignId)}' Limit 1`
      );
    return records[0]?.Id;
  }

  async findContactIdsByEmails(
    emails: string[]
  ): Promise<Record<string, string>> {
    if (emails.length === 0) return {};
    await this.checkIfConnected();
    const escapedEmails = emails
      .map((e) => `'${escapeQuery(e.normalize('NFD').replace(/[̀-ͯ]/g, ''))}'`)
      .join(', ');
    const { records }: { records: { Email: string; Id: string }[] } =
      await this.salesforce.query(
        `SELECT Id, Email FROM ${ObjectNames.CONTACT} WHERE Email IN (${escapedEmails})`
      );
    return records.reduce<Record<string, string>>((acc, r) => {
      if (r.Email) acc[r.Email.toLowerCase()] = r.Id;
      return acc;
    }, {});
  }

  async findEventParticipationCountByContactIds(
    contactIds: string[]
  ): Promise<Record<string, number>> {
    if (contactIds.length === 0) return {};
    await this.checkIfConnected();
    const escapedIds = contactIds
      .map((id) => `'${escapeQuery(id)}'`)
      .join(', ');
    const { records }: { records: { ContactId: string; expr0: number }[] } =
      await this.salesforce.query(
        `SELECT ContactId, COUNT(Id)
         FROM ${ObjectNames.CAMPAIGN_MEMBER}
         WHERE ContactId IN (${escapedIds})
           AND Status = 'Inscrit'
           AND Campaign.Type = 'Event'
           AND Campaign.R_seaux__c INCLUDES ('LinkedOut')
         GROUP BY ContactId`
      );
    return records.reduce<Record<string, number>>((acc, r) => {
      acc[r.ContactId] = r.expr0;
      return acc;
    }, {});
  }

  async findAllCampaignMembersByCampaignId(
    campaignId: string,
    status?: SalesforceCampaignStatus
  ) {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceCampaignMember>[] } =
      await this.salesforce.query(
        `SELECT Id, LeadId, ContactId, Status, Email
          FROM ${ObjectNames.CAMPAIGN_MEMBER}
          WHERE CampaignId = '${escapeQuery(campaignId)}'
          ${status ? `AND Status = '${escapeQuery(status)}'` : ''}
        `
      );
    return records as SalesforceCampaignMember[];
  }

  async findBinomeByCandidateSfId<T extends string>(id: T) {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceBinome>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.BINOME}
         WHERE Candidat_LinkedOut__c = '${id}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findTaskById<T extends string>(id: T): Promise<string> {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceTask>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.TASK}
         WHERE ID_Externe__c = '${id}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async createAccount(
    {
      name,
      businessSectors,
      address,
      department,
      mainAccountSfId,
      phone,
      organizationType,
    }: AccountProps,
    recordType: AccountRecordType
  ) {
    let parsedAddress = null;
    if (address) {
      parsedAddress = parseAddress(address);
    }

    return this.createRecord(ObjectNames.ACCOUNT, {
      Name: mainAccountSfId
        ? formatCompanyName(name, department, address)
        : name || 'Inconnu',
      M_tiers_LinkedOut__c: formatBusinessSectors(businessSectors),
      BillingStreet: parsedAddress?.street,
      BillingCity:
        parsedAddress?.city?.length > 40
          ? parsedAddress?.city.substring(0, 40)
          : parsedAddress?.city,
      BillingPostalCode: parsedAddress?.postalCode,
      Reseaux__c: 'LinkedOut',
      Antenne__c: formatDepartment(department),
      RecordTypeId: recordType,
      ParentId: mainAccountSfId,
      Phone: phone,
      Type_org__c: organizationType,
    });
  }

  async updateAccount<T extends AccountRecordType>(
    accountSfId: string,
    recordType: T,
    data: AccountProps
  ) {
    let parsedAddress = null;
    if (data.address) {
      parsedAddress = parseAddress(data.address);
    }

    return this.updateRecord(ObjectNames.ACCOUNT, {
      Id: accountSfId,
      Name: data.name,
      M_tiers_LinkedOut__c: formatBusinessSectors(data.businessSectors),
      BillingStreet: parsedAddress?.street,
      BillingCity:
        parsedAddress?.city?.length > 40
          ? parsedAddress?.city.substring(0, 40)
          : parsedAddress?.city,
      BillingPostalCode: parsedAddress?.postalCode,
      Antenne__c: formatDepartment(data.department),
      RecordTypeId: recordType,
      Phone: data.phone,
    });
  }

  async updateLead<T extends LeadRecordType>(
    leadSfId: string,
    leadProps: LeadProp<T>,
    recordType: T
  ) {
    const record = mapSalesforceLeadFields(leadProps, recordType);

    return this.updateRecord<typeof ObjectNames.LEAD, T>(ObjectNames.LEAD, {
      Id: leadSfId,
      ...record,
    });
  }

  async updateLeadPhoneAndRecordType<T extends LeadRecordType>(
    leadSfId: string,
    leadProps: Pick<LeadProp<T>, 'phone'>,
    recordType: T
  ) {
    return this.updateRecord(ObjectNames.LEAD, {
      Id: leadSfId,
      Phone: leadProps.phone,
      RecordTypeId: recordType,
    });
  }

  async createLead<T extends LeadRecordType>(
    leadProps: LeadProp<T>,
    recordType: T
  ) {
    const record = mapSalesforceLeadFields(leadProps, recordType);

    return this.createRecord<typeof ObjectNames.LEAD, T>(
      ObjectNames.LEAD,
      record
    );
  }

  async updateContact(
    contactSfId: string,
    contactProps: ContactProps,
    recordType: ContactRecordType
  ) {
    const record = mapSalesforceContactFields(contactProps, recordType);
    return this.updateRecord(ObjectNames.CONTACT, {
      Id: contactSfId,
      ...record,
    });
  }

  async updateContactSocialSituation(
    contactSfId: string,
    contactProps: Pick<
      ContactProps,
      | 'nationality'
      | 'accommodation'
      | 'hasSocialWorker'
      | 'resources'
      | 'studiesLevel'
      | 'workingExperience'
      | 'jobSearchDuration'
    >
  ) {
    const socialSituationSfFields =
      mapSalesforceContactSocialSituationFields(contactProps);
    return this.updateRecord(ObjectNames.CONTACT, {
      Id: contactSfId,
      ...socialSituationSfFields,
    });
  }

  async updateContactCasquetteAndAppId(
    contactSfId: string,
    contactProps: Pick<ContactProps, 'casquettes' | 'id' | 'reseaux'>
  ) {
    return this.updateRecord(ObjectNames.CONTACT, {
      Id: contactSfId,
      ID_App_Entourage_Pro__c: contactProps.id,
      Casquettes_r_les__c: contactProps.casquettes.join(';'),
      Reseaux__c: contactProps.reseaux.join(';'),
    });
  }

  async updateContactEmailAndPhone(
    contactSfId: string,
    contactProps: Pick<ContactProps, 'email' | 'phone'>
  ) {
    return this.updateRecord(ObjectNames.CONTACT, {
      Id: contactSfId,
      Email: contactProps.email,
      Phone: contactProps.phone,
    });
  }

  async createContact(
    contactProps: ContactProps,
    recordType: ContactRecordType
  ) {
    const record = mapSalesforceContactFields(contactProps, recordType);

    // Hack : update Contact after creation to set right RecordTypeId because RecordTypeId isn't taken into account when using create
    const contactSfIdToUpdate = (await this.createRecord(
      ObjectNames.CONTACT,
      record
    )) as string;

    try {
      return (await this.updateContact(
        contactSfIdToUpdate,
        contactProps,
        recordType
      )) as string;
    } catch (err) {
      if ((err as SalesforceError).errorCode === ErrorCodes.NOT_FOUND) {
        return contactSfIdToUpdate;
      }
      if (
        (err as SalesforceError).errorCode === ErrorCodes.UNABLE_TO_LOCK_ROW
      ) {
        // eslint-disable-next-line no-console
        console.log('LOCK ROW IN createContact');
        return (await this.updateContact(
          contactSfIdToUpdate,
          contactProps,
          recordType
        )) as string;
      }
    }
  }

  async findOrCreateHouseholdAccount({
    name,
    department,
    address,
  }: AccountProps) {
    let accountSfId = await this.searchAccount(`${name} ${address}`);

    if (!accountSfId) {
      accountSfId = (await this.createAccount(
        {
          name,
          department,
          address,
        },
        AccountRecordTypesIds.HOUSEHOLD
      )) as string;
    }
    return accountSfId;
  }

  async findOrCreateAssociationAccount({
    name,
    address,
    department,
  }: AccountProps) {
    let accountSfId = await this.searchAccount(name);

    if (!accountSfId) {
      accountSfId = (await this.createAccount(
        {
          name,
          address: address,
          department: department,
        },
        AccountRecordTypesIds.ASSOCIATION
      )) as string;
    }
    return accountSfId;
  }

  async findOrCreateLead<T extends LeadRecordType>(
    lead: LeadProp<T>,
    recordType: T
  ) {
    const leadSfId = await this.findLead(lead.email);

    if (!leadSfId) {
      // Hack : update Lead after creation to set right RecordTypeId because RecordTypeId isn't taken into account when using create
      const leadSfIdToUpdate = (await this.createLead(
        lead,
        recordType
      )) as string;

      try {
        return (await this.updateLead(
          leadSfIdToUpdate,
          lead,
          recordType
        )) as string;
      } catch (err) {
        if ((err as SalesforceError).errorCode === ErrorCodes.NOT_FOUND) {
          return leadSfIdToUpdate;
        }
        if (
          (err as SalesforceError).errorCode === ErrorCodes.UNABLE_TO_LOCK_ROW
        ) {
          // eslint-disable-next-line no-console
          console.log('LOCK ROW IN findOrCreateLead');
          return (await this.updateLead(
            leadSfIdToUpdate,
            lead,
            recordType
          )) as string;
        }
      }
    }
    return leadSfId;
  }

  async findOrCreateLeadFromCompanyForm({
    firstName,
    lastName,
    email,
    phone,
    company,
    position,
    zone,
    approach,
    heardAbout,
    message,
  }: CompanyLeadProps) {
    return (await this.findOrCreateLead(
      {
        firstName,
        lastName,
        company,
        position,
        email,
        phone,
        zone,
        approach,
        heardAbout,
        message,
      },
      LeadRecordTypesIds.COMPANY
    )) as string;
  }

  async findOrCreateContactFromUserRegistrationForm({
    id,
    firstName,
    lastName,
    email,
    phone,
    department,
    role,
    birthDate,
    nationality,
    accommodation,
    hasSocialWorker,
    resources,
    studiesLevel,
    workingExperience,
    jobSearchDuration,
    gender,
    structure,
    refererId,
    isCompanyAdmin = false,
    position,
  }: UserProps) {
    const contactSf = await this.findContact(email, undefined, id);
    let contactSfId = contactSf?.Id;

    const casquette: Casquette = getCasquette(role);

    // refererId here is the referrer's own Postgres User.id - resolve their Salesforce Contact
    // id from the local sfContactId mirror first (no Salesforce round-trip), falling back to a
    // live lookup by ID_App_Entourage_Pro__c (which also repairs/mirrors it for next time).
    const refererContactSfId = refererId
      ? await this.findRefererContactSfId(refererId)
      : undefined;

    // Contact doesnt exist in SF -> Create
    if (!contactSfId) {
      const leadSfId = await this.findLead(email);

      const accountSfId =
        role === UserRoles.REFERER
          ? await this.findOrCreateAssociationAccount({
              name: structure,
              department: department,
              address: getPostalCodeFromDepartment(department),
            })
          : await this.findOrCreateHouseholdAccount({
              name: `${firstName} ${lastName} Foyer`,
              department,
              address: getPostalCodeFromDepartment(department),
            });

      const contactToCreate = {
        id,
        firstName,
        lastName,
        birthDate,
        // Hack to have a contact with the same mail and phone as the prospect if it exists
        email: prependDuplicateIfCondition(email, !!leadSfId),
        phone: prependDuplicateIfCondition(phone, !!leadSfId),
        department,
        accountSfId,
        nationality,
        accommodation,
        hasSocialWorker,
        resources,
        studiesLevel,
        workingExperience,
        jobSearchDuration,
        gender,
        // ContactProps.refererId expects the referrer's Salesforce Contact id, not their
        // Postgres user id (see refererContactSfId resolution above).
        refererId: refererContactSfId,
        position,
      } as ContactProps;

      contactSfId = (await this.createContact(
        {
          ...contactToCreate,
          casquettes: [casquette],
        },
        determineContactRecordType(role, isCompanyAdmin)
      )) as string;
      await this.syncUserSfContactId(id, contactSfId);

      if (leadSfId) {
        // Hack to have a contact with the same mail and phone as the prospect if it exists
        await this.updateContactEmailAndPhone(contactSfId, { email, phone });
      }
    } else {
      // Contact exist in SF -> Update

      // Add the casquette and the LinkedOut network to whatever this contact already has
      // (e.g. a casquette or a network from Entourage Local) - never replace existing values.
      const uniqueCasquettes = addToSalesforceMultiPicklist(
        contactSf.Casquettes_r_les__c,
        casquette
      );
      const uniqueReseaux = addToSalesforceMultiPicklist(
        contactSf.Reseaux__c,
        'LinkedOut'
      );

      await this.updateContactCasquetteAndAppId(contactSfId, {
        id,
        casquettes: uniqueCasquettes,
        reseaux: uniqueReseaux,
      });

      // Update the socialSituation fields
      contactSfId = (await this.updateContactSocialSituation(contactSfId, {
        nationality,
        accommodation,
        hasSocialWorker,
        resources,
        studiesLevel,
        workingExperience,
        jobSearchDuration,
      })) as string;
    }

    return contactSfId;
  }

  /**
   * Resolves the Salesforce Contact id of a referrer (a Pro user, typically a REFERER/
   * prescripteur) from their Postgres User.id, for `ContactProps.refererId` /
   * `TS_prescripteur__c`. Reads the `sfContactId` mirror first - no Salesforce round-trip -
   * falling back to a live lookup by `ID_App_Entourage_Pro__c` (which also repairs/mirrors
   * `sfContactId` for next time) when the mirror isn't populated yet.
   */
  private async findRefererContactSfId(
    refererId: string
  ): Promise<string | undefined> {
    const referer = await this.usersService.findOneWithAttributes(refererId, [
      'id',
      'email',
      'sfContactId',
    ]);
    if (!referer) {
      return undefined;
    }
    if (referer.sfContactId) {
      return referer.sfContactId;
    }
    return (await this.findContact(referer.email, undefined, referer.id))?.Id;
  }

  async createOrUpdateCampaignMember(
    leadOrContactId: { contactId?: string; leadId?: string },
    campaignId: string,
    status: SalesforceCampaignStatus
  ) {
    this.setIsWorker(false);
    await this.checkIfConnected();

    const campaignMemberSfId = await this.findCampaignMember(
      leadOrContactId,
      campaignId
    );
    const { leadId, contactId } = leadOrContactId;
    if (!campaignMemberSfId) {
      await this.createRecord(ObjectNames.CAMPAIGN_MEMBER, {
        ...(leadId
          ? {
              LeadId: leadId,
            }
          : { ContactId: contactId }),
        CampaignId: campaignId,
        Status: status,
      });
    } else {
      await this.updateRecord(ObjectNames.CAMPAIGN_MEMBER, {
        Id: campaignMemberSfId,
        Status: status,
      });
    }
  }

  async findContactFromUserId(
    userId: string
  ): Promise<
    Pick<
      UserProps,
      | 'id'
      | 'firstName'
      | 'lastName'
      | 'email'
      | 'phone'
      | 'department'
      | 'role'
    >
  > {
    const userDb = await this.usersService.findOneWithRelations(userId);

    return {
      id: userDb.id,
      firstName: userDb.firstName,
      lastName: userDb.lastName,
      email: userDb.email,
      phone: userDb.phone,
      department: userDb.userProfile.department,
      role: userDb.role as RegistrableUserRole,
    };
  }

  async createOrUpdateSalesforceUser(
    userId: string,
    otherInfo: {
      accommodation?: CandidateAccommodation;
      birthDate: Date;
      campaign?: string;
      gender?: CandidateGender;
      hasSocialWorker?: YesNoJNSPRValue;
      isCompanyAdmin?: boolean;
      jobSearchDuration?: JobSearchDuration;
      nationality?: Nationality;
      position?: string;
      refererId?: string;
      resources?: CandidateResource;
      structure?: string;
      studiesLevel?: StudiesLevel;
      workingExperience?: WorkingExperience;
      workingRight?: CandidateYesNoNSPPValue;
    }
  ) {
    this.setIsWorker(true);

    const userToCreate = await this.findContactFromUserId(userId);

    return this.findOrCreateContactFromUserRegistrationForm({
      ...userToCreate,
      birthDate: otherInfo.birthDate,
      campaign: otherInfo.campaign,
      workingRight: otherInfo.workingRight,
      nationality: otherInfo.nationality,
      accommodation: otherInfo.accommodation,
      hasSocialWorker: otherInfo.hasSocialWorker,
      resources: otherInfo.resources,
      studiesLevel: otherInfo.studiesLevel,
      workingExperience: otherInfo.workingExperience,
      jobSearchDuration: otherInfo.jobSearchDuration,
      gender: otherInfo.gender,
      refererId: otherInfo.refererId,
      structure: otherInfo.structure,
      isCompanyAdmin: otherInfo.isCompanyAdmin,
      position: otherInfo.position,
    });
  }

  async createOrUpdateSalesforceCompany(
    companyName: string,
    data: { department?: string; phone?: string }
  ) {
    this.setIsWorker(false);

    const createUpdateDto = {
      name: companyName,
      department: data.department,
      phone: data.phone,
      organizationType: 'Entreprise',
    };
    const sfCompany = await this.findCompanyFromCompanyName(companyName);

    if (!sfCompany) {
      const newCompanyId = (await this.createAccount(
        createUpdateDto as AccountProps,
        AccountRecordTypesIds.COMPANY
      )) as string;
      return newCompanyId;
    }
    await this.updateAccount(
      sfCompany.Id,
      AccountRecordTypesIds.COMPANY,
      createUpdateDto as AccountProps
    );
    return sfCompany.Id;
  }

  /**
   * Link or unlink a Salesforce contact to a company account in Salesforce
   * Never creates or updates a Company account here - only an existing Company admin flow does that
   * (via createOrUpdateSalesforceCompany). If hasAdmin is false, or the Company account can't be
   * found in Salesforce despite hasAdmin being true, the contact falls back to a household account
   *
   * @param userId user's id in our database
   * @param companyName company name to link the user to in Salesforce, or null to unlink from any company
   * @param isCompanyAdmin whether this specific user is the admin of the declared company (used for RecordType only)
   * @param hasAdmin whether the declared company has any admin at all (gates Company account lookup)
   */
  async updateSalesforceUserCompany(
    userId: string,
    companyName: string | null,
    isCompanyAdmin = false,
    hasAdmin = false
  ): Promise<{ companyAccountNotFound: boolean }> {
    this.setIsWorker(true);

    const userToUpdate = await this.findContactFromUserId(userId);

    const contactSf = await this.findContact(
      userToUpdate.email,
      undefined,
      userId
    );

    if (!contactSf || !contactSf.Id) {
      await this.slackService.sendTechnicalMonitoringMessage(
        false,
        '⚠️ Contact Salesforce introuvable pour un utilisateur existant',
        [
          { title: 'Utilisateur', content: userId },
          { title: 'Email recherché', content: userToUpdate.email },
        ]
      );
      throw new Error(`Contact not found in Salesforce for user ${userId}`);
    }

    const contactSfId = contactSf.Id;

    // Read-only lookup of the existing Company account: only when the declared company already has an admin
    let accountSfId: string | null = null;
    let companyAccountNotFound = false;
    if (companyName && hasAdmin) {
      const sfCompany = await this.findCompanyFromCompanyName(companyName);
      if (sfCompany) {
        accountSfId = sfCompany.Id;
      } else {
        companyAccountNotFound = true;
      }
    }

    // No admin, no company declared, or Company account not found: fall back to a household account
    if (!accountSfId) {
      accountSfId = await this.findOrCreateHouseholdAccount({
        name: `${userToUpdate.firstName} ${userToUpdate.lastName} Foyer`,
        department: userToUpdate.department,
        address: getPostalCodeFromDepartment(userToUpdate.department),
      });
    }

    if (!accountSfId) {
      throw new Error(
        `SF Account not found or created for user ${userId} with companyName ${companyName}`
      );
    }

    await this.updateContact(
      contactSfId,
      {
        accountSfId,
        companyName,
        // Preserve any network already on the contact (e.g. Entourage Local) - mapSalesforceContactFields
        // only defaults Reseaux__c to 'LinkedOut' when `reseaux` is omitted, which would otherwise
        // overwrite it on every company update.
        reseaux: addToSalesforceMultiPicklist(
          contactSf.Reseaux__c,
          'LinkedOut'
        ),
      },
      determineContactRecordType(userToUpdate.role, isCompanyAdmin)
    );

    return { companyAccountNotFound };
  }

  async createOrUpdateCompanySalesforceLead(lead: CompanyLeadProps) {
    this.setIsWorker(false);
    return this.findOrCreateLeadFromCompanyForm(lead);
  }

  async getCandidateCampaigns() {
    this.setIsWorker(false);
    await this.checkIfConnected();

    const {
      records: timeZoneRecords,
    }: { records: { TimeZoneSidKey: string }[] } = await this.salesforce.query(
      `SELECT TimeZoneSidKey
       FROM Organization ${
         process.env.SF_ORGANIZATION_ID
           ? `WHERE Id = '${process.env.SF_ORGANIZATION_ID}'`
           : ''
       } LIMIT 1`
    );

    const timeZone = timeZoneRecords[0]?.TimeZoneSidKey;

    const { records }: { records: SalesforceCampaign[] } =
      await this.salesforce.query(
        `SELECT Id,
                Code_postal__c,
                Adresse_de_l_v_nement__c,
                Antenne__c,
                StartDate,
                Heure_de_d_but__c
         FROM ${ObjectNames.CAMPAIGN}
         WHERE ParentId = '${process.env.SF_INFOCO_CAMPAIGN_ID}'
           AND StartDate > TODAY
           AND IsActive = true
           AND Status != 'Aborted'
         ORDER BY StartDate asc`
      );

    // Remove the "Z" behind the time fetched from Salesforce to use it as is and not as UTC
    // Parse it using the timezone from Salesforce to manage DST

    return records.map((record) => {
      return {
        id: record.Id,
        antenne: record.Antenne__c,
        address: record.Adresse_de_l_v_nement__c
          ? `${record.Adresse_de_l_v_nement__c}${
              record.Code_postal__c ? ` ${record.Code_postal__c}` : ''
            }`
          : null,
        time: moment
          .tz(
            `${record.StartDate} ${record.Heure_de_d_but__c?.replace('Z', '')}`,
            timeZone
          )
          .format(),
      };
    });
  }

  async getCoachCampaigns() {
    this.setIsWorker(false);
    await this.checkIfConnected();

    const {
      records: timeZoneRecords,
    }: { records: { TimeZoneSidKey: string }[] } = await this.salesforce.query(
      `SELECT TimeZoneSidKey
       FROM Organization ${
         process.env.SF_ORGANIZATION_ID
           ? `WHERE Id = '${process.env.SF_ORGANIZATION_ID}'`
           : ''
       } LIMIT 1`
    );

    const timeZone = timeZoneRecords[0]?.TimeZoneSidKey;

    const { records }: { records: SalesforceCampaign[] } =
      await this.salesforce.query(
        `SELECT Id,
                StartDate,
                Heure_de_d_but__c
         FROM ${ObjectNames.CAMPAIGN}
         WHERE ParentId = '${process.env.SF_WEBINAIRE_COACH_CAMPAIGN_ID}'
           AND StartDate > TODAY
           AND IsActive = true
           AND Status != 'Aborted'
         ORDER BY StartDate asc`
      );

    // Remove the "Z" behind the time fetched from Salesforce to use it as is and not as UTC
    // Parse it using the timezone from Salesforce to manage DST

    return records.map((record) => {
      return {
        id: record.Id,
        time: moment
          .tz(
            `${record.StartDate} ${record.Heure_de_d_but__c?.replace('Z', '')}`,
            timeZone
          )
          .format(),
      };
    });
  }
}
