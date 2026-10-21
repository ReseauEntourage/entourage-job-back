import {
  CandidateGenders,
  CandidateAccommodations,
  Nationalities,
} from 'src/contacts/contacts.types';
import { EventMode, EventType } from 'src/events/event.types';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import {
  AccountRecordTypesIds,
  Casquette,
  ContactRecordTypesIds,
  ErrorCodes,
  LeadRecordTypesIds,
  ObjectNames,
  SalesforceCampaignStatus,
} from 'src/external-services/salesforce/salesforce.types';
import { UserRoles } from 'src/users/users.types';

// SalesforceService is exercised directly with mocked collaborators (no network, no real
// jsforce connection), like the other specs of tests/salesforce.
const buildService = () => {
  const usersService = {
    updateSfContactId: jest.fn().mockResolvedValue(undefined),
    findOneWithAttributes: jest.fn(),
    findOneWithRelations: jest.fn(),
  };
  const slackService = {
    sendTechnicalMonitoringMessage: jest.fn().mockResolvedValue(undefined),
  };
  const service = new SalesforceService(
    usersService as never,
    slackService as never
  );
  const connection = { query: jest.fn(), search: jest.fn() };
  (service as unknown as { salesforce: unknown }).salesforce = connection;
  jest.spyOn(service, 'checkIfConnected').mockResolvedValue(undefined);
  return { service, connection, usersService, slackService };
};

describe('SalesforceService - contact resolution (findContact)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('resolves by app id first and mirrors the contact id on the user', async () => {
    const { service, connection, usersService } = buildService();
    connection.query.mockResolvedValueOnce({
      records: [
        {
          Id: 'c1',
          Casquettes_r_les__c: 'Coach;Candidat',
          Reseaux__c: 'LinkedOut',
        },
      ],
    });

    const contact = await service.findContact(
      'a@example.com',
      ContactRecordTypesIds.COMPANY,
      'user-1'
    );

    expect(contact).toEqual({
      Id: 'c1',
      Casquettes_r_les__c: ['Coach', 'Candidat'],
      Reseaux__c: ['LinkedOut'],
    });
    expect(connection.query.mock.calls[0][0]).toContain(
      `RecordTypeId = '${ContactRecordTypesIds.COMPANY}'`
    );
    expect(usersService.updateSfContactId).toHaveBeenCalledWith('user-1', 'c1');
  });

  it('does not fail when mirroring the contact id fails', async () => {
    const { service, connection, usersService } = buildService();
    usersService.updateSfContactId.mockRejectedValue(new Error('db down'));
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    connection.query.mockResolvedValueOnce({
      records: [{ Id: 'c1', Casquettes_r_les__c: '', Reseaux__c: '' }],
    });

    const contact = await service.findContact('a@example.com', undefined, 'u');

    expect(contact.Id).toBe('c1');
  });

  it('returns null when neither app id nor email match', async () => {
    const { service, connection } = buildService();
    connection.query.mockResolvedValue({ records: [] });

    expect(await service.findContact('none@example.com')).toBeNull();
    expect(
      await service.findContact('none@example.com', undefined, 'u')
    ).toBeNull();
  });

  it('falls back to the email, stripping accents, and repairs an empty app id', async () => {
    const { service, connection } = buildService();
    connection.query
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({
        records: [{ Id: 'c2', Casquettes_r_les__c: '', Reseaux__c: '' }],
      });
    const updateSpy = jest
      .spyOn(service, 'updateRecord')
      .mockResolvedValue('c2');

    const contact = await service.findContact(
      'élodie@example.com',
      undefined,
      'u2'
    );

    expect(contact.Id).toBe('c2');
    expect(connection.query.mock.calls[1][0]).toContain("'elodie@example.com'");
    expect(updateSpy).toHaveBeenCalledWith(ObjectNames.CONTACT, {
      Id: 'c2',
      ID_App_Entourage_Pro__c: 'u2',
    });
  });

  it('accepts a contact found by email already linked to the same user', async () => {
    const { service, connection } = buildService();
    connection.query
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'c3',
            ID_App_Entourage_Pro__c: 'u3',
            Casquettes_r_les__c: '',
          },
        ],
      });
    const updateSpy = jest.spyOn(service, 'updateRecord');

    const contact = await service.findContact('x@example.com', undefined, 'u3');

    expect(contact.Id).toBe('c3');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('treats a contact linked to another user as not found and alerts Slack', async () => {
    const { service, connection, slackService } = buildService();
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    connection.query
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'c4',
            ID_App_Entourage_Pro__c: 'other',
            Casquettes_r_les__c: '',
          },
        ],
      });

    expect(
      await service.findContact('x@example.com', undefined, 'me')
    ).toBeNull();
    expect(slackService.sendTechnicalMonitoringMessage).toHaveBeenCalledTimes(
      1
    );
  });

  it('keeps going when the Slack alert itself fails', async () => {
    const { service, connection, slackService } = buildService();
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    slackService.sendTechnicalMonitoringMessage.mockRejectedValue(
      new Error('slack down')
    );
    connection.query
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'c4',
            ID_App_Entourage_Pro__c: 'other',
            Casquettes_r_les__c: '',
          },
        ],
      });

    expect(
      await service.findContact('x@example.com', undefined, 'me')
    ).toBeNull();
  });

  it('findContact without app id returns the mapped email match', async () => {
    const { service, connection } = buildService();
    connection.query.mockResolvedValue({
      records: [{ Id: 'c5', Casquettes_r_les__c: 'Coach', Reseaux__c: 'A;B' }],
    });

    expect(await service.findContact('x@example.com')).toEqual({
      Id: 'c5',
      Casquettes_r_les__c: ['Coach'],
      Reseaux__c: ['A', 'B'],
    });
  });
});

describe('SalesforceService - event campaigns', () => {
  afterEach(() => jest.restoreAllMocks());

  it('findAllEventCampaigns builds every filter of the query', async () => {
    const { service, connection } = buildService();
    jest
      .spyOn(service, 'findContact')
      .mockResolvedValue({ Id: 'contact-1' } as never);
    connection.query.mockResolvedValue({ records: [{ Id: 'camp' }] });

    const records = await service.findAllEventCampaigns(
      'u@example.com',
      10,
      5,
      false,
      true,
      "o'brien",
      [EventMode.ONLINE, EventMode.IRL],
      [EventType.NETWORKING],
      ['Paris' as never],
      ['Jeunes' as never],
      'user-1'
    );

    expect(records).toEqual([{ Id: 'camp' }]);
    const query = connection.query.mock.calls[0][0] as string;
    expect(query).toContain("En_Ligne__c = 'Oui'");
    expect(query).toContain("En_Ligne__c = 'Non' OR En_Ligne__c = NULL");
    expect(query).toContain('Type_evenement__c =');
    expect(query).toContain("Name LIKE '%o\\'brien%'");
    expect(query).toContain("Antenne__c INCLUDES ('Paris')");
    expect(query).toContain("Public_sensibilis__c INCLUDES ('Jeunes')");
    expect(query).toContain('AND Id IN (');
    expect(query).toContain(SalesforceCampaignStatus.REGISTERED);
    expect(query).toContain('StartDate > TODAY');
    expect(query).toContain('LIMIT 10 OFFSET 5');
  });

  it('findAllEventCampaigns supports the not-participating and past events variants', async () => {
    const { service, connection } = buildService();
    jest
      .spyOn(service, 'findContact')
      .mockResolvedValue({ Id: 'contact-1' } as never);
    connection.query.mockResolvedValue({ records: [] });

    await service.findAllEventCampaigns('u@example.com', 1, 0, true, false);

    const query = connection.query.mock.calls[0][0] as string;
    expect(query).toContain('AND Id NOT IN (');
    expect(query).not.toContain('StartDate > TODAY');
  });

  it('findAllEventCampaigns works without user email', async () => {
    const { service, connection } = buildService();
    const findContactSpy = jest.spyOn(service, 'findContact');
    connection.query.mockResolvedValue({ records: [] });

    await service.findAllEventCampaigns('', 1, 0, true, null);

    expect(findContactSpy).not.toHaveBeenCalled();
    expect(connection.query.mock.calls[0][0]).not.toContain('CampaignMembers');
  });

  it('findEventCampaignById returns the campaign or null', async () => {
    const { service, connection } = buildService();
    jest
      .spyOn(service, 'findContact')
      .mockResolvedValue({ Id: 'contact-1' } as never);
    connection.query
      .mockResolvedValueOnce({ records: [{ Id: 'camp-1' }] })
      .mockResolvedValueOnce({ records: [] });

    expect(
      await service.findEventCampaignById('u@example.com', 'camp-1', 'user-1')
    ).toEqual({ Id: 'camp-1' });
    expect(connection.query.mock.calls[0][0]).toContain('CampaignMembers');
    expect(await service.findEventCampaignById('', 'camp-2')).toBeNull();
  });

  it('createOrUpdateCampaignMember creates a member for a lead or a contact', async () => {
    const { service } = buildService();
    jest.spyOn(service, 'findCampaignMember').mockResolvedValue(undefined);
    const createSpy = jest
      .spyOn(service, 'createRecord')
      .mockResolvedValue('x');

    await service.createOrUpdateCampaignMember(
      { leadId: 'l1' },
      'camp',
      SalesforceCampaignStatus.REGISTERED
    );
    await service.createOrUpdateCampaignMember(
      { contactId: 'c1' },
      'camp',
      SalesforceCampaignStatus.RESPONDED
    );

    expect(createSpy).toHaveBeenNthCalledWith(1, ObjectNames.CAMPAIGN_MEMBER, {
      LeadId: 'l1',
      CampaignId: 'camp',
      Status: SalesforceCampaignStatus.REGISTERED,
    });
    expect(createSpy).toHaveBeenNthCalledWith(2, ObjectNames.CAMPAIGN_MEMBER, {
      ContactId: 'c1',
      CampaignId: 'camp',
      Status: SalesforceCampaignStatus.RESPONDED,
    });
  });

  it('createOrUpdateCampaignMember updates an existing member', async () => {
    const { service } = buildService();
    jest.spyOn(service, 'findCampaignMember').mockResolvedValue('cm-1');
    const updateSpy = jest
      .spyOn(service, 'updateRecord')
      .mockResolvedValue('x');

    await service.createOrUpdateCampaignMember(
      { contactId: 'c1' },
      'camp',
      SalesforceCampaignStatus.RESPONDED
    );

    expect(updateSpy).toHaveBeenCalledWith(ObjectNames.CAMPAIGN_MEMBER, {
      Id: 'cm-1',
      Status: SalesforceCampaignStatus.RESPONDED,
    });
  });

  describe('getCandidateCampaigns / getCoachCampaigns', () => {
    const envBackup = { ...process.env };
    afterEach(() => {
      process.env = { ...envBackup };
    });

    it('maps candidate campaigns using the Salesforce organization time zone', async () => {
      process.env.SF_ORGANIZATION_ID = 'org-1';
      process.env.SF_INFOCO_CAMPAIGN_ID = 'info-1';
      const { service, connection } = buildService();
      connection.query
        .mockResolvedValueOnce({
          records: [{ TimeZoneSidKey: 'Europe/Paris' }],
        })
        .mockResolvedValueOnce({
          records: [
            {
              Id: 'camp-1',
              Antenne__c: 'Paris',
              Adresse_de_l_v_nement__c: '1 rue X',
              Code_postal__c: '75001',
              StartDate: '2030-05-01',
              Heure_de_d_but__c: '10:00:00.000Z',
            },
            {
              Id: 'camp-2',
              Antenne__c: 'Lyon',
              Adresse_de_l_v_nement__c: '2 rue Y',
              StartDate: '2030-01-10',
              Heure_de_d_but__c: '09:30:00.000Z',
            },
            {
              Id: 'camp-3',
              Antenne__c: 'Lille',
              StartDate: '2030-01-10',
              Heure_de_d_but__c: '09:30:00.000Z',
            },
          ],
        });

      const campaigns = await service.getCandidateCampaigns();

      expect(connection.query.mock.calls[0][0]).toContain("Id = 'org-1'");
      expect(connection.query.mock.calls[1][0]).toContain(
        "ParentId = 'info-1'"
      );
      expect(campaigns[0]).toEqual({
        id: 'camp-1',
        antenne: 'Paris',
        address: '1 rue X 75001',
        time: '2030-05-01T10:00:00+02:00',
      });
      expect(campaigns[1].address).toBe('2 rue Y');
      expect(campaigns[1].time).toBe('2030-01-10T09:30:00+01:00');
      expect(campaigns[2].address).toBeNull();
    });

    it('maps coach campaigns, without organization filter when none is configured', async () => {
      delete process.env.SF_ORGANIZATION_ID;
      process.env.SF_WEBINAIRE_COACH_CAMPAIGN_ID = 'web-1';
      const { service, connection } = buildService();
      connection.query
        .mockResolvedValueOnce({
          records: [{ TimeZoneSidKey: 'Europe/Paris' }],
        })
        .mockResolvedValueOnce({
          records: [
            {
              Id: 'camp-9',
              StartDate: '2030-07-01',
              Heure_de_d_but__c: '14:00:00.000Z',
            },
          ],
        });

      const campaigns = await service.getCoachCampaigns();

      expect(connection.query.mock.calls[0][0]).not.toContain('WHERE Id');
      expect(connection.query.mock.calls[1][0]).toContain("ParentId = 'web-1'");
      expect(campaigns).toEqual([
        { id: 'camp-9', time: '2030-07-01T14:00:00+02:00' },
      ]);
    });

    it('getCandidateCampaigns tolerates a missing organization time zone row', async () => {
      const { service, connection } = buildService();
      connection.query
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] });

      expect(await service.getCandidateCampaigns()).toEqual([]);
      connection.query
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] });
      expect(await service.getCoachCampaigns()).toEqual([]);
    });
  });
});

describe('SalesforceService - accounts, leads and contacts writers', () => {
  afterEach(() => jest.restoreAllMocks());

  it('createAccount maps and truncates fields', async () => {
    const { service } = buildService();
    const createSpy = jest
      .spyOn(service, 'createRecord')
      .mockResolvedValue('a1');

    await service.createAccount(
      {
        name: 'Acme',
        address: `3 rue Z, 75010 ${'V'.repeat(50)}`,
        department: 'Paris (75)' as never,
        mainAccountSfId: 'parent',
        phone: '0102030405',
        organizationType: 'Entreprise',
      } as never,
      AccountRecordTypesIds.COMPANY
    );
    await service.createAccount(
      { department: undefined } as never,
      AccountRecordTypesIds.HOUSEHOLD
    );

    const first = createSpy.mock.calls[0][1] as Record<string, string>;
    expect(first.Name).toBe(
      `Acme - 3 rue Z, 75010 ${'V'.repeat(50)} - Paris (75)`
    );
    expect(first.BillingCity).toHaveLength(40);
    expect(first.BillingPostalCode).toBe('75010');
    expect(first.ParentId).toBe('parent');
    const second = createSpy.mock.calls[1][1] as Record<string, string>;
    expect(second.Name).toBe('Inconnu');
    expect(second.Antenne__c).toBe('National');
  });

  it('updateAccount maps the fields and truncates a long city', async () => {
    const { service } = buildService();
    const updateSpy = jest
      .spyOn(service, 'updateRecord')
      .mockResolvedValue('a1');

    await service.updateAccount('a1', AccountRecordTypesIds.COMPANY, {
      name: 'Acme',
      address: `3 rue Z 75010 ${'V'.repeat(50)}`,
      department: 'Paris (75)',
      phone: '01',
    } as never);
    await service.updateAccount('a1', AccountRecordTypesIds.COMPANY, {
      name: 'Acme',
    } as never);

    const first = updateSpy.mock.calls[0][1] as Record<string, string>;
    expect(first.BillingCity).toHaveLength(40);
    expect(first.Id).toBe('a1');
    expect(
      (updateSpy.mock.calls[1][1] as Record<string, string>).Antenne__c
    ).toBe('National');
  });

  it('createLead / updateLead / updateLeadPhoneAndRecordType delegate to the record writers', async () => {
    const { service } = buildService();
    const createSpy = jest
      .spyOn(service, 'createRecord')
      .mockResolvedValue('l1');
    const updateSpy = jest
      .spyOn(service, 'updateRecord')
      .mockResolvedValue('l1');
    const lead = {
      firstName: 'Jo',
      lastName: 'Doe',
      email: 'jo@example.com',
      company: 'Acme',
      position: 'CEO',
    } as never;

    await service.createLead(lead, LeadRecordTypesIds.COMPANY);
    await service.updateLead('l1', lead, LeadRecordTypesIds.COMPANY);
    await service.updateLeadPhoneAndRecordType(
      'l1',
      { phone: '0600' },
      LeadRecordTypesIds.COACH
    );

    expect(createSpy).toHaveBeenCalledWith(
      ObjectNames.LEAD,
      expect.objectContaining({ Company: 'Acme', Title: 'CEO' })
    );
    expect(updateSpy).toHaveBeenNthCalledWith(
      1,
      ObjectNames.LEAD,
      expect.objectContaining({ Id: 'l1', Company: 'Acme' })
    );
    expect(updateSpy).toHaveBeenNthCalledWith(2, ObjectNames.LEAD, {
      Id: 'l1',
      Phone: '0600',
      RecordTypeId: LeadRecordTypesIds.COACH,
    });
  });

  it('contact writers delegate to updateRecord with the right fields', async () => {
    const { service } = buildService();
    const updateSpy = jest
      .spyOn(service, 'updateRecord')
      .mockResolvedValue('c1');

    await service.updateContact(
      'c1',
      { firstName: 'Jo', lastName: 'Doe' } as never,
      ContactRecordTypesIds.PRECARIOUS
    );
    await service.updateContactSocialSituation('c1', {
      nationality: Nationalities.FRENCH,
      accommodation: CandidateAccommodations.PERSONAL,
    });
    await service.updateContactCasquetteAndAppId('c1', {
      id: 'user-1',
      casquettes: [Casquette.COACH_COUP_DE_POUCE],
      reseaux: ['LinkedOut'],
    });
    await service.updateContactEmailAndPhone('c1', {
      email: 'a@example.com',
      phone: '06',
    });

    expect(updateSpy).toHaveBeenCalledTimes(4);
    expect(updateSpy.mock.calls[2][1]).toEqual({
      Id: 'c1',
      ID_App_Entourage_Pro__c: 'user-1',
      Casquettes_r_les__c: Casquette.COACH_COUP_DE_POUCE,
      Reseaux__c: 'LinkedOut',
    });
    expect(updateSpy.mock.calls[3][1]).toEqual({
      Id: 'c1',
      Email: 'a@example.com',
      Phone: '06',
    });
  });

  describe('createContact', () => {
    const props = {
      firstName: 'Jo',
      lastName: 'Doe',
      gender: CandidateGenders.MALE,
    } as never;

    it('creates then updates the contact to set its record type', async () => {
      const { service } = buildService();
      jest.spyOn(service, 'createRecord').mockResolvedValue('c1');
      const updateSpy = jest
        .spyOn(service, 'updateContact')
        .mockResolvedValue('c1');

      expect(
        await service.createContact(props, ContactRecordTypesIds.PRECARIOUS)
      ).toBe('c1');
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    it('returns the created id when the update answers NOT_FOUND', async () => {
      const { service } = buildService();
      jest.spyOn(service, 'createRecord').mockResolvedValue('c1');
      jest
        .spyOn(service, 'updateContact')
        .mockRejectedValue({ errorCode: ErrorCodes.NOT_FOUND });

      expect(
        await service.createContact(props, ContactRecordTypesIds.PRECARIOUS)
      ).toBe('c1');
    });

    it('retries the update once on UNABLE_TO_LOCK_ROW', async () => {
      const { service } = buildService();
      jest.spyOn(console, 'log').mockImplementation(() => undefined);
      jest.spyOn(service, 'createRecord').mockResolvedValue('c1');
      const updateSpy = jest
        .spyOn(service, 'updateContact')
        .mockRejectedValueOnce({ errorCode: ErrorCodes.UNABLE_TO_LOCK_ROW })
        .mockResolvedValueOnce('c1-updated');

      expect(
        await service.createContact(props, ContactRecordTypesIds.PRECARIOUS)
      ).toBe('c1-updated');
      expect(updateSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('findOrCreateHouseholdAccount / findOrCreateAssociationAccount create only when absent', async () => {
    const { service } = buildService();
    const searchSpy = jest
      .spyOn(service, 'searchAccount')
      .mockResolvedValueOnce('existing')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('existing-2')
      .mockResolvedValueOnce(undefined);
    const createSpy = jest
      .spyOn(service, 'createAccount')
      .mockResolvedValue('new');

    const props = {
      name: 'N',
      department: 'Paris (75)',
      address: '75000',
    } as never;
    expect(await service.findOrCreateHouseholdAccount(props)).toBe('existing');
    expect(await service.findOrCreateHouseholdAccount(props)).toBe('new');
    expect(await service.findOrCreateAssociationAccount(props)).toBe(
      'existing-2'
    );
    expect(await service.findOrCreateAssociationAccount(props)).toBe('new');

    expect(searchSpy).toHaveBeenCalledWith('N 75000');
    expect(createSpy.mock.calls.map((c) => c[1])).toEqual([
      AccountRecordTypesIds.HOUSEHOLD,
      AccountRecordTypesIds.ASSOCIATION,
    ]);
  });

  describe('findOrCreateLead', () => {
    const lead = { email: 'jo@example.com', lastName: 'Doe' } as never;

    it('returns the existing lead without creating', async () => {
      const { service } = buildService();
      jest.spyOn(service, 'findLead').mockResolvedValue('lead-1');
      const createSpy = jest.spyOn(service, 'createLead');

      expect(
        await service.findOrCreateLead(lead, LeadRecordTypesIds.COMPANY)
      ).toBe('lead-1');
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('creates then updates a new lead', async () => {
      const { service } = buildService();
      jest.spyOn(service, 'findLead').mockResolvedValue(undefined);
      jest.spyOn(service, 'createLead').mockResolvedValue('l-new');
      jest.spyOn(service, 'updateLead').mockResolvedValue('l-upd');

      expect(
        await service.findOrCreateLead(lead, LeadRecordTypesIds.COMPANY)
      ).toBe('l-upd');
    });

    it('falls back to the created id on NOT_FOUND', async () => {
      const { service } = buildService();
      jest.spyOn(service, 'findLead').mockResolvedValue(undefined);
      jest.spyOn(service, 'createLead').mockResolvedValue('l-new');
      jest
        .spyOn(service, 'updateLead')
        .mockRejectedValue({ errorCode: ErrorCodes.NOT_FOUND });

      expect(
        await service.findOrCreateLead(lead, LeadRecordTypesIds.COMPANY)
      ).toBe('l-new');
    });

    it('retries once on UNABLE_TO_LOCK_ROW', async () => {
      const { service } = buildService();
      jest.spyOn(console, 'log').mockImplementation(() => undefined);
      jest.spyOn(service, 'findLead').mockResolvedValue(undefined);
      jest.spyOn(service, 'createLead').mockResolvedValue('l-new');
      jest
        .spyOn(service, 'updateLead')
        .mockRejectedValueOnce({ errorCode: ErrorCodes.UNABLE_TO_LOCK_ROW })
        .mockResolvedValueOnce('l-retry');

      expect(
        await service.findOrCreateLead(lead, LeadRecordTypesIds.COMPANY)
      ).toBe('l-retry');
    });

    it('findOrCreateLeadFromCompanyForm / createOrUpdateCompanySalesforceLead use the company record type', async () => {
      const { service } = buildService();
      const spy = jest
        .spyOn(service, 'findOrCreateLead')
        .mockResolvedValue('l1');

      await service.createOrUpdateCompanySalesforceLead({
        firstName: 'Jo',
        lastName: 'Doe',
        email: 'jo@example.com',
        company: 'Acme',
      } as never);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ company: 'Acme' }),
        LeadRecordTypesIds.COMPANY
      );
    });
  });
});

describe('SalesforceService - user registration and company flows', () => {
  afterEach(() => jest.restoreAllMocks());

  const baseUser = {
    id: 'user-1',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '0600000000',
    department: 'Paris (75)',
    birthDate: new Date('1990-01-01'),
  };

  it('creates a candidate contact with a household account, mirroring the id', async () => {
    const { service, usersService } = buildService();
    jest.spyOn(service, 'findContact').mockResolvedValue(null);
    jest.spyOn(service, 'findLead').mockResolvedValue(undefined);
    const householdSpy = jest
      .spyOn(service, 'findOrCreateHouseholdAccount')
      .mockResolvedValue('acc-1');
    const createSpy = jest
      .spyOn(service, 'createContact')
      .mockResolvedValue('contact-new');

    const id = await service.findOrCreateContactFromUserRegistrationForm({
      ...baseUser,
      role: UserRoles.CANDIDATE,
    } as never);

    expect(id).toBe('contact-new');
    expect(householdSpy).toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        casquettes: [Casquette.CANDIDAT_COUP_DE_POUCE],
      }),
      ContactRecordTypesIds.PRECARIOUS
    );
    expect(usersService.updateSfContactId).toHaveBeenCalledWith(
      'user-1',
      'contact-new'
    );
  });

  it('creates a referer contact on an association account, prefixing duplicate lead data', async () => {
    const { service, usersService } = buildService();
    jest.spyOn(service, 'findContact').mockResolvedValue(null);
    jest.spyOn(service, 'findLead').mockResolvedValue('lead-1');
    usersService.findOneWithAttributes.mockResolvedValue({
      id: 'ref',
      sfContactId: 'ref-contact',
    });
    const assoSpy = jest
      .spyOn(service, 'findOrCreateAssociationAccount')
      .mockResolvedValue('asso-1');
    const createSpy = jest
      .spyOn(service, 'createContact')
      .mockResolvedValue('contact-new');
    const emailPhoneSpy = jest
      .spyOn(service, 'updateContactEmailAndPhone')
      .mockResolvedValue('contact-new');

    await service.findOrCreateContactFromUserRegistrationForm({
      ...baseUser,
      role: UserRoles.REFERER,
      structure: 'Asso',
      refererId: 'ref',
    } as never);

    expect(assoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Asso' })
    );
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'bis_jane@example.com',
        phone: 'bis_0600000000',
        refererId: 'ref-contact',
      }),
      ContactRecordTypesIds.ASSOCIATION
    );
    expect(emailPhoneSpy).toHaveBeenCalledWith('contact-new', {
      email: 'jane@example.com',
      phone: '0600000000',
    });
  });

  it('resolves the referer contact through a live lookup when no mirror exists', async () => {
    const { service, usersService } = buildService();
    const findContactSpy = jest
      .spyOn(service, 'findContact')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ Id: 'ref-live' } as never);
    jest.spyOn(service, 'findLead').mockResolvedValue(undefined);
    jest.spyOn(service, 'findOrCreateHouseholdAccount').mockResolvedValue('a');
    const createSpy = jest
      .spyOn(service, 'createContact')
      .mockResolvedValue('c');
    usersService.findOneWithAttributes.mockResolvedValue({
      id: 'ref',
      email: 'ref@example.com',
    });

    await service.findOrCreateContactFromUserRegistrationForm({
      ...baseUser,
      role: UserRoles.COACH,
      refererId: 'ref',
    } as never);

    expect(findContactSpy).toHaveBeenLastCalledWith(
      'ref@example.com',
      undefined,
      'ref'
    );
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ refererId: 'ref-live' }),
      ContactRecordTypesIds.NEIGHBOR
    );
  });

  it('ignores an unknown referer', async () => {
    const { service, usersService } = buildService();
    jest.spyOn(service, 'findContact').mockResolvedValue(null);
    jest.spyOn(service, 'findLead').mockResolvedValue(undefined);
    jest.spyOn(service, 'findOrCreateHouseholdAccount').mockResolvedValue('a');
    const createSpy = jest
      .spyOn(service, 'createContact')
      .mockResolvedValue('c');
    usersService.findOneWithAttributes.mockResolvedValue(null);

    await service.findOrCreateContactFromUserRegistrationForm({
      ...baseUser,
      role: UserRoles.COACH,
      refererId: 'ghost',
      isCompanyAdmin: true,
    } as never);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ refererId: undefined }),
      ContactRecordTypesIds.COMPANY
    );
  });

  it('createOrUpdateSalesforceUser loads the user then delegates to the registration flow', async () => {
    const { service, usersService } = buildService();
    usersService.findOneWithRelations.mockResolvedValue({
      ...baseUser,
      role: UserRoles.CANDIDATE,
      userProfile: { department: 'Paris (75)' },
    });
    const flowSpy = jest
      .spyOn(service, 'findOrCreateContactFromUserRegistrationForm')
      .mockResolvedValue('contact-1');

    const result = await service.createOrUpdateSalesforceUser('user-1', {
      birthDate: new Date('1990-01-01'),
      structure: 'Asso',
    });

    expect(result).toBe('contact-1');
    expect(flowSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        department: 'Paris (75)',
        structure: 'Asso',
      })
    );
  });

  describe('createOrUpdateSalesforceCompany', () => {
    it('creates the company account when absent', async () => {
      const { service } = buildService();
      jest.spyOn(service, 'findCompanyFromCompanyName').mockResolvedValue(null);
      const createSpy = jest
        .spyOn(service, 'createAccount')
        .mockResolvedValue('new-acc');

      expect(
        await service.createOrUpdateSalesforceCompany('Acme', { phone: '01' })
      ).toBe('new-acc');
      expect(createSpy.mock.calls[0][1]).toBe(AccountRecordTypesIds.COMPANY);
    });

    it('updates the company account when it exists', async () => {
      const { service } = buildService();
      jest
        .spyOn(service, 'findCompanyFromCompanyName')
        .mockResolvedValue({ Id: 'acc-1', Name: 'Acme' });
      const updateSpy = jest
        .spyOn(service, 'updateAccount')
        .mockResolvedValue('acc-1');

      expect(await service.createOrUpdateSalesforceCompany('Acme', {})).toBe(
        'acc-1'
      );
      expect(updateSpy).toHaveBeenCalledWith(
        'acc-1',
        AccountRecordTypesIds.COMPANY,
        expect.objectContaining({
          name: 'Acme',
          organizationType: 'Entreprise',
        })
      );
    });
  });

  describe('findContactFromUserId', () => {
    it('maps the database user', async () => {
      const { service, usersService } = buildService();
      usersService.findOneWithRelations.mockResolvedValue({
        ...baseUser,
        role: UserRoles.COACH,
        userProfile: { department: 'Rhône (69)' },
      });

      expect(await service.findContactFromUserId('user-1')).toEqual({
        id: 'user-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '0600000000',
        department: 'Rhône (69)',
        role: UserRoles.COACH,
      });
    });
  });

  describe('updateSalesforceUserCompany', () => {
    const setup = () => {
      const ctx = buildService();
      jest.spyOn(ctx.service, 'findContactFromUserId').mockResolvedValue({
        ...baseUser,
        role: UserRoles.COACH,
      } as never);
      return ctx;
    };

    it('throws and alerts Slack when the contact is not in Salesforce', async () => {
      const { service, slackService } = setup();
      jest.spyOn(service, 'findContact').mockResolvedValue(null);

      await expect(
        service.updateSalesforceUserCompany('user-1', 'Acme')
      ).rejects.toThrow('Contact not found in Salesforce for user user-1');
      expect(slackService.sendTechnicalMonitoringMessage).toHaveBeenCalled();
    });

    it('links the contact to the existing company account of an administered company', async () => {
      const { service } = setup();
      jest
        .spyOn(service, 'findContact')
        .mockResolvedValue({ Id: 'c1', Reseaux__c: ['Local'] } as never);
      jest
        .spyOn(service, 'findCompanyFromCompanyName')
        .mockResolvedValue({ Id: 'company-acc', Name: 'Acme' });
      const updateSpy = jest
        .spyOn(service, 'updateContact')
        .mockResolvedValue('c1');

      const result = await service.updateSalesforceUserCompany(
        'user-1',
        'Acme',
        true,
        true
      );

      expect(result).toEqual({ companyAccountNotFound: false });
      expect(updateSpy).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          accountSfId: 'company-acc',
          reseaux: ['Local', 'LinkedOut'],
        }),
        ContactRecordTypesIds.COMPANY
      );
    });

    it('falls back to a household account when the company account is missing', async () => {
      const { service } = setup();
      jest
        .spyOn(service, 'findContact')
        .mockResolvedValue({ Id: 'c1', Reseaux__c: [] } as never);
      jest.spyOn(service, 'findCompanyFromCompanyName').mockResolvedValue(null);
      jest
        .spyOn(service, 'findOrCreateHouseholdAccount')
        .mockResolvedValue('household');
      const updateSpy = jest
        .spyOn(service, 'updateContact')
        .mockResolvedValue('c1');

      const result = await service.updateSalesforceUserCompany(
        'user-1',
        'Acme',
        false,
        true
      );

      expect(result).toEqual({ companyAccountNotFound: true });
      expect(updateSpy.mock.calls[0][1]).toEqual(
        expect.objectContaining({ accountSfId: 'household' })
      );
    });

    it('unlinks from any company when no company name is given', async () => {
      const { service } = setup();
      jest
        .spyOn(service, 'findContact')
        .mockResolvedValue({ Id: 'c1', Reseaux__c: [] } as never);
      const companySpy = jest.spyOn(service, 'findCompanyFromCompanyName');
      jest
        .spyOn(service, 'findOrCreateHouseholdAccount')
        .mockResolvedValue('household');
      const updateSpy = jest
        .spyOn(service, 'updateContact')
        .mockResolvedValue('c1');

      await service.updateSalesforceUserCompany('user-1', null);

      expect(companySpy).not.toHaveBeenCalled();
      expect(updateSpy.mock.calls[0][1]).toEqual(
        expect.objectContaining({ companyName: null })
      );
    });

    it('throws when no account can be found or created', async () => {
      const { service } = setup();
      jest
        .spyOn(service, 'findContact')
        .mockResolvedValue({ Id: 'c1', Reseaux__c: [] } as never);
      jest
        .spyOn(service, 'findOrCreateHouseholdAccount')
        .mockResolvedValue(undefined);

      await expect(
        service.updateSalesforceUserCompany('user-1', null)
      ).rejects.toThrow('SF Account not found or created for user user-1');
    });
  });
});

describe('SalesforceService - backfill helpers', () => {
  afterEach(() => jest.restoreAllMocks());

  it('findContactsByEmailForBackfill returns every candidate and strips accents', async () => {
    const { service, connection } = buildService();
    connection.query.mockResolvedValue({ records: [{ Id: '1' }, { Id: '2' }] });

    expect(
      await service.findContactsByEmailForBackfill('élodie@example.com')
    ).toEqual([{ Id: '1' }, { Id: '2' }]);
    expect(connection.query.mock.calls[0][0]).toContain("'elodie@example.com'");
  });

  it('completeContactNetworkAndCasquette adds the missing network and casquette', async () => {
    const { service } = buildService();
    const updateSpy = jest
      .spyOn(service, 'updateRecord')
      .mockResolvedValue('c1');

    const result = await service.completeContactNetworkAndCasquette(
      { Id: 'c1', Reseaux__c: 'Local', Casquettes_r_les__c: '' },
      Casquette.COACH_COUP_DE_POUCE
    );

    expect(result).toEqual({
      networkAdded: true,
      casquetteAdded: Casquette.COACH_COUP_DE_POUCE,
    });
    expect(updateSpy).toHaveBeenCalledWith(ObjectNames.CONTACT, {
      Id: 'c1',
      Reseaux__c: 'Local;LinkedOut',
      Casquettes_r_les__c: Casquette.COACH_COUP_DE_POUCE,
    });
  });

  it('completeContactNetworkAndCasquette only adds the casquette when LinkedOut is present', async () => {
    const { service } = buildService();
    const updateSpy = jest
      .spyOn(service, 'updateRecord')
      .mockResolvedValue('c1');

    const result = await service.completeContactNetworkAndCasquette(
      { Id: 'c1', Reseaux__c: 'LinkedOut' },
      Casquette.PRESCRIPTEUR
    );

    expect(result.networkAdded).toBe(false);
    expect(updateSpy.mock.calls[0][1]).not.toHaveProperty('Reseaux__c');
  });

  it('completeContactNetworkAndCasquette does nothing when everything is present', async () => {
    const { service } = buildService();
    const updateSpy = jest.spyOn(service, 'updateRecord');

    expect(
      await service.completeContactNetworkAndCasquette(
        {
          Id: 'c1',
          Reseaux__c: 'LinkedOut',
          Casquettes_r_les__c: Casquette.PRESCRIPTEUR,
        },
        Casquette.PRESCRIPTEUR
      )
    ).toEqual({ networkAdded: false, casquetteAdded: null });
    expect(
      await service.completeContactNetworkAndCasquette(
        { Id: 'c1', Reseaux__c: 'LinkedOut' },
        null
      )
    ).toEqual({ networkAdded: false, casquetteAdded: null });
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
