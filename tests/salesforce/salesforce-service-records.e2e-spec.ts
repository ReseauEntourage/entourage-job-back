import { EventEmitter } from 'events';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import {
  ErrorCodes,
  ObjectNames,
} from 'src/external-services/salesforce/salesforce.types';

// SalesforceService is exercised directly with a mocked jsforce connection: the API test
// harness does not set up a real Salesforce connection and no network call is allowed.
type Mocked = {
  bulk: { createJob: jest.Mock };
  query: jest.Mock;
  search: jest.Mock;
  sobject: jest.Mock;
};

const buildService = () => {
  const usersService = {
    updateSfContactId: jest.fn().mockResolvedValue(undefined),
  };
  const slackService = {
    sendTechnicalMonitoringMessage: jest.fn().mockResolvedValue(undefined),
  };
  const service = new SalesforceService(
    usersService as never,
    slackService as never
  );
  const connection: Mocked = {
    query: jest.fn(),
    search: jest.fn(),
    sobject: jest.fn(),
    bulk: { createJob: jest.fn() },
  };
  (service as unknown as { salesforce: Mocked }).salesforce = connection;
  return { service, connection, usersService, slackService };
};

/**
 * Builds a fake bulk job whose single batch emits 'queue' then 'response' (or 'error').
 */
const fakeBulkJob = (results?: unknown[], error?: unknown) => {
  const batch = new EventEmitter() as EventEmitter & {
    execute: jest.Mock;
    poll: jest.Mock;
  };
  batch.poll = jest.fn();
  batch.execute = jest.fn(() => {
    setImmediate(() => {
      if (error) {
        batch.emit('error', error);
      } else {
        batch.emit('queue', { id: 'batch-1' });
        batch.emit('response', results);
      }
    });
  });
  return { job: { createBatch: () => batch }, batch };
};

describe('SalesforceService - connection', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.SALESFORCE_LOGIN_URL = 'https://sf.invalid';
    process.env.SALESFORCE_CLIENT_ID = 'client-id';
    process.env.SALESFORCE_CLIENT_SECRET = 'client-secret';
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
  });

  it('loginToSalesforce builds a connection from the token response', async () => {
    const { service } = buildService();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'token',
          instance_url: 'https://instance.invalid',
        }),
    } as Response);

    await service.loginToSalesforce();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://sf.invalid/services/oauth2/token',
      expect.objectContaining({ method: 'POST' })
    );
    const connection = (
      service as unknown as { salesforce: { accessToken: string } }
    ).salesforce;
    expect(connection.accessToken).toBe('token');
  });

  it('loginToSalesforce throws when the token endpoint answers an error', async () => {
    const { service } = buildService();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('bad credentials'),
    } as Response);

    await expect(service.loginToSalesforce()).rejects.toThrow(
      'Salesforce authentication failed: bad credentials'
    );
  });

  it('checkIfConnected does not re-login when the probe query succeeds', async () => {
    const { service, connection } = buildService();
    connection.query.mockResolvedValue({ records: [] });
    const refreshSpy = jest.spyOn(service, 'refreshSalesforceInstance');

    await service.checkIfConnected();

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('checkIfConnected refreshes the instance when the probe query fails', async () => {
    const { service, connection } = buildService();
    connection.query.mockRejectedValue(new Error('session expired'));
    const refreshSpy = jest
      .spyOn(service, 'refreshSalesforceInstance')
      .mockResolvedValue(undefined);

    await service.checkIfConnected();

    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('refreshSalesforceInstance rethrows immediately when not a worker', async () => {
    const { service } = buildService();
    service.setIsWorker(false);
    jest
      .spyOn(service, 'loginToSalesforce')
      .mockRejectedValue(new Error('login down'));

    await expect(service.refreshSalesforceInstance()).rejects.toThrow(
      'login down'
    );
  });

  it('refreshSalesforceInstance retries as a worker until login succeeds', async () => {
    const { service } = buildService();
    service.setIsWorker(true);
    const loginSpy = jest
      .spyOn(service, 'loginToSalesforce')
      .mockRejectedValueOnce(new Error('login down'))
      .mockResolvedValueOnce(undefined);
    // Skip the (10 minutes) retry delay
    jest.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
      cb();
      return 0;
    }) as never);

    await service.refreshSalesforceInstance();

    expect(loginSpy).toHaveBeenCalledTimes(2);
  });

  it('refreshSalesforceInstance gives up when retries are exhausted', async () => {
    const { service } = buildService();
    service.setIsWorker(true);
    jest
      .spyOn(service, 'loginToSalesforce')
      .mockRejectedValue(new Error('login down'));

    await expect(service.refreshSalesforceInstance(0)).rejects.toThrow(
      'login down'
    );
  });
});

describe('SalesforceService - createRecord / updateRecord / upsertRecord', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setup = () => {
    const ctx = buildService();
    jest.spyOn(ctx.service, 'checkIfConnected').mockResolvedValue(undefined);
    return ctx;
  };

  const duplicateError = {
    errorCode: ErrorCodes.DUPLICATES_DETECTED,
    duplicateResult: {
      matchResults: [{ matchRecords: [{ record: { Id: 'dup-id' } }] }],
    },
  };

  describe('createRecord', () => {
    it('inserts a single record and returns its id', async () => {
      const { service, connection } = setup();
      const insert = jest
        .fn()
        .mockResolvedValue({ success: true, id: 'new-1' });
      connection.sobject.mockReturnValue({ insert });

      const id = await service.createRecord(ObjectNames.ACCOUNT, {
        Name: 'Acme',
      } as never);

      expect(id).toBe('new-1');
      expect(connection.sobject).toHaveBeenCalledWith('Account');
    });

    it('throws the Salesforce errors when the insert is not successful', async () => {
      const { service, connection } = setup();
      connection.sobject.mockReturnValue({
        insert: jest
          .fn()
          .mockResolvedValue({ success: false, errors: ['boom'] }),
      });

      await expect(
        service.createRecord(ObjectNames.ACCOUNT, { Name: 'x' } as never)
      ).rejects.toEqual(['boom']);
    });

    it('returns the id of the duplicate when a duplicate is detected', async () => {
      const { service, connection } = setup();
      connection.sobject.mockReturnValue({
        insert: jest.fn().mockRejectedValue(duplicateError),
      });

      const id = await service.createRecord(ObjectNames.CONTACT, {
        LastName: 'Doe',
      } as never);

      expect(id).toBe('dup-id');
    });

    it('rethrows unknown errors', async () => {
      const { service, connection } = setup();
      const error = { errorCode: 'OTHER', message: 'nope' };
      connection.sobject.mockReturnValue({
        insert: jest.fn().mockRejectedValue(error),
      });

      await expect(
        service.createRecord(ObjectNames.CONTACT, { LastName: 'Doe' } as never)
      ).rejects.toBe(error);
    });

    it('bulk inserts and only keeps the ids of successful rows', async () => {
      const { service, connection } = setup();
      const { job } = fakeBulkJob([
        { success: true, id: 'a' },
        { success: false, errors: ['bad row'] },
        { success: true, id: 'c' },
      ]);
      connection.bulk.createJob.mockReturnValue(job);

      const ids = await service.createRecord(ObjectNames.CONTACT, [
        { LastName: '1' },
        { LastName: '2' },
        { LastName: '3' },
      ] as never);

      expect(ids).toEqual(['a', 'c']);
      expect(connection.bulk.createJob).toHaveBeenCalledWith(
        'Contact',
        'insert'
      );
    });

    it('rejects when the bulk batch emits an error', async () => {
      const { service, connection } = setup();
      const error = new Error('batch failed');
      connection.bulk.createJob.mockReturnValue(
        fakeBulkJob(undefined, error).job
      );

      await expect(
        service.createRecord(ObjectNames.CONTACT, [{ LastName: '1' }] as never)
      ).rejects.toBe(error);
    });
  });

  describe('updateRecord', () => {
    it('updates a single record and returns its id', async () => {
      const { service, connection } = setup();
      connection.sobject.mockReturnValue({
        update: jest.fn().mockResolvedValue({ success: true, id: 'u-1' }),
      });

      const id = await service.updateRecord(ObjectNames.CONTACT, {
        Id: 'u-1',
      } as never);

      expect(id).toBe('u-1');
    });

    it('throws when the update is not successful', async () => {
      const { service, connection } = setup();
      connection.sobject.mockReturnValue({
        update: jest
          .fn()
          .mockResolvedValue({ success: false, errors: ['denied'] }),
      });

      await expect(
        service.updateRecord(ObjectNames.CONTACT, { Id: 'u-1' } as never)
      ).rejects.toEqual(['denied']);
    });

    it('returns the duplicate id on DUPLICATES_DETECTED', async () => {
      const { service, connection } = setup();
      connection.sobject.mockReturnValue({
        update: jest.fn().mockRejectedValue(duplicateError),
      });

      expect(
        await service.updateRecord(ObjectNames.CONTACT, { Id: 'u-1' } as never)
      ).toBe('dup-id');
    });

    it('swallows CANNOT_UPDATE_CONVERTED_LEAD for a single record', async () => {
      const { service, connection } = setup();
      connection.sobject.mockReturnValue({
        update: jest.fn().mockRejectedValue({
          errorCode: ErrorCodes.CANNOT_UPDATE_CONVERTED_LEAD,
        }),
      });

      expect(
        await service.updateRecord(ObjectNames.LEAD, { Id: 'lead-1' } as never)
      ).toBe('lead-1');
    });

    it('swallows CANNOT_UPDATE_CONVERTED_LEAD for a bulk update', async () => {
      const { service, connection } = setup();
      connection.bulk.createJob.mockReturnValue({
        createBatch: () => {
          throw {
            errorCode: ErrorCodes.CANNOT_UPDATE_CONVERTED_LEAD,
          };
        },
      });

      expect(
        await service.updateRecord(ObjectNames.LEAD, [
          { Id: 'l1' },
          { Id: 'l2' },
        ] as never)
      ).toEqual(['l1', 'l2']);
    });

    it('rethrows unknown errors', async () => {
      const { service, connection } = setup();
      const error = { errorCode: 'OTHER' };
      connection.sobject.mockReturnValue({
        update: jest.fn().mockRejectedValue(error),
      });

      await expect(
        service.updateRecord(ObjectNames.CONTACT, { Id: 'u' } as never)
      ).rejects.toBe(error);
    });

    it('bulk updates and keeps only successful ids', async () => {
      const { service, connection } = setup();
      connection.bulk.createJob.mockReturnValue(
        fakeBulkJob([
          { success: true, id: 'a' },
          { success: false, errors: ['x'] },
        ]).job
      );

      expect(
        await service.updateRecord(ObjectNames.CONTACT, [
          { Id: 'a' },
          { Id: 'b' },
        ] as never)
      ).toEqual(['a']);
      expect(connection.bulk.createJob).toHaveBeenCalledWith(
        'Contact',
        'update'
      );
    });
  });

  describe('upsertRecord', () => {
    it('upserts a single record and returns the id', async () => {
      const { service, connection } = setup();
      const upsert = jest.fn().mockResolvedValue({ success: true, id: 't-1' });
      connection.sobject.mockReturnValue({ upsert });

      const id = await service.upsertRecord(
        ObjectNames.TASK,
        { ID_Externe__c: 'ext-1' } as never,
        'ID_Externe__c' as never,
        'findTaskById'
      );

      expect(id).toBe('t-1');
      expect(upsert).toHaveBeenCalledWith(
        { ID_Externe__c: 'ext-1' },
        'ID_Externe__c'
      );
    });

    it('falls back to findTaskById when no id is returned', async () => {
      const { service, connection } = setup();
      connection.sobject.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ success: true }),
      });
      const findSpy = jest
        .spyOn(service, 'findTaskById')
        .mockResolvedValue('found-id');

      const id = await service.upsertRecord(
        ObjectNames.TASK,
        { ID_Externe__c: 'ext-1' } as never,
        'ID_Externe__c' as never,
        'findTaskById'
      );

      expect(id).toBe('found-id');
      expect(findSpy).toHaveBeenCalledWith('ext-1');
    });

    it('throws when the upsert is not successful', async () => {
      const { service, connection } = setup();
      connection.sobject.mockReturnValue({
        upsert: jest
          .fn()
          .mockResolvedValue({ success: false, errors: ['nope'] }),
      });

      await expect(
        service.upsertRecord(
          ObjectNames.TASK,
          { ID_Externe__c: 'e' } as never,
          'ID_Externe__c' as never,
          'findTaskById'
        )
      ).rejects.toEqual(['nope']);
    });

    it('returns the duplicate id on DUPLICATES_DETECTED', async () => {
      const { service, connection } = setup();
      connection.sobject.mockReturnValue({
        upsert: jest.fn().mockRejectedValue(duplicateError),
      });

      expect(
        await service.upsertRecord(
          ObjectNames.TASK,
          { ID_Externe__c: 'e' } as never,
          'ID_Externe__c' as never,
          'findTaskById'
        )
      ).toBe('dup-id');
    });

    it('rethrows unknown errors', async () => {
      const { service, connection } = setup();
      const error = { errorCode: 'OTHER' };
      connection.sobject.mockReturnValue({
        upsert: jest.fn().mockRejectedValue(error),
      });

      await expect(
        service.upsertRecord(
          ObjectNames.TASK,
          { ID_Externe__c: 'e' } as never,
          'ID_Externe__c' as never,
          'findTaskById'
        )
      ).rejects.toBe(error);
    });

    it('bulk upserts, resolving missing ids through findTaskById', async () => {
      const { service, connection } = setup();
      connection.bulk.createJob.mockReturnValue(
        fakeBulkJob([
          { success: true, id: 'a' },
          { success: true },
          { success: false, errors: ['x'] },
        ]).job
      );
      jest.spyOn(service, 'findTaskById').mockResolvedValue('resolved');

      const ids = await service.upsertRecord(
        ObjectNames.TASK,
        [
          { ID_Externe__c: 'e1' },
          { ID_Externe__c: 'e2' },
          { ID_Externe__c: 'e3' },
        ] as never,
        'ID_Externe__c' as never,
        'findTaskById'
      );

      expect(ids).toEqual(['a', 'resolved']);
      expect(connection.bulk.createJob).toHaveBeenCalledWith('Task', 'upsert', {
        extIdField: 'ID_Externe__c',
      });
    });
  });
});

describe('SalesforceService - simple lookups', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const setup = () => {
    const ctx = buildService();
    jest.spyOn(ctx.service, 'checkIfConnected').mockResolvedValue(undefined);
    return ctx;
  };

  it('searchAccountByName uses a LIKE query for a one-character search', async () => {
    const { service, connection } = setup();
    connection.query.mockResolvedValue({ records: [{ Id: 'acc-1' }] });

    const id = await service.searchAccountByName('a', 'rt-1' as never);

    expect(id).toBe('acc-1');
    expect(connection.query.mock.calls[0][0]).toContain("Name LIKE 'a%'");
    expect(connection.search).not.toHaveBeenCalled();
  });

  it('searchAccountByName uses SOSL with an escaped search term otherwise', async () => {
    const { service, connection } = setup();
    connection.search.mockResolvedValue({ searchRecords: [{ Id: 'acc-2' }] });

    const id = await service.searchAccountByName('Acme (Paris)', 'rt' as never);

    expect(id).toBe('acc-2');
    expect(connection.search.mock.calls[0][0]).toContain('Acme \\(Paris\\)');
  });

  it('searchAccountByName returns undefined when nothing matches', async () => {
    const { service, connection } = setup();
    connection.search.mockResolvedValue({ searchRecords: [] });

    expect(await service.searchAccountByName('Unknown', 'rt' as never)).toBe(
      undefined
    );
  });

  it('searchAccount returns the first account id', async () => {
    const { service, connection } = setup();
    connection.search.mockResolvedValue({ searchRecords: [{ Id: 'acc-3' }] });

    expect(await service.searchAccount('Foo & Bar')).toBe('acc-3');
    expect(connection.search.mock.calls[0][0]).toContain('Foo \\& Bar');
  });

  it('findLead returns the lead id, optionally filtered by record type', async () => {
    const { service, connection } = setup();
    connection.query.mockResolvedValue({ records: [{ Id: 'lead-1' }] });

    expect(await service.findLead("o'neil@example.com", 'rt-1' as never)).toBe(
      'lead-1'
    );
    const query = connection.query.mock.calls[0][0];
    expect(query).toContain("Email = 'o\\'neil@example.com'");
    expect(query).toContain("RecordTypeId = 'rt-1'");
  });

  it('findLead returns undefined when there is no lead', async () => {
    const { service, connection } = setup();
    connection.query.mockResolvedValue({ records: [] });

    expect(await service.findLead('none@example.com')).toBeUndefined();
  });

  it('findCompanyFromCompanyName returns the record or null', async () => {
    const { service, connection } = setup();
    connection.query.mockResolvedValueOnce({
      records: [{ Id: 'c1', Name: 'Acme' }],
    });
    connection.query.mockResolvedValueOnce({ records: [] });

    expect(await service.findCompanyFromCompanyName('Acme')).toEqual({
      Id: 'c1',
      Name: 'Acme',
    });
    expect(await service.findCompanyFromCompanyName('Nope')).toBeNull();
  });

  it('findOwnerByLeadSfId returns the owner id', async () => {
    const { service, connection } = setup();
    connection.query.mockResolvedValue({ records: [{ OwnerId: 'owner-1' }] });

    expect(await service.findOwnerByLeadSfId('lead-1')).toBe('owner-1');
  });

  it('findCampaignMember queries by lead id or by contact id', async () => {
    const { service, connection } = setup();
    connection.query.mockResolvedValue({ records: [{ Id: 'cm-1' }] });

    expect(await service.findCampaignMember({ leadId: 'l1' }, 'camp')).toBe(
      'cm-1'
    );
    expect(connection.query.mock.calls[0][0]).toContain("LeadId = 'l1'");

    await service.findCampaignMember({ contactId: 'c1' }, 'camp');
    expect(connection.query.mock.calls[1][0]).toContain("ContactId = 'c1'");
  });

  it('findContactIdsByEmails returns an empty map without querying for no email', async () => {
    const { service, connection } = setup();

    expect(await service.findContactIdsByEmails([])).toEqual({});
    expect(connection.query).not.toHaveBeenCalled();
  });

  it('findContactIdsByEmails maps lowercase emails to contact ids', async () => {
    const { service, connection } = setup();
    connection.query.mockResolvedValue({
      records: [
        { Email: 'Jane@Example.com', Id: 'c1' },
        { Email: null, Id: 'c2' },
      ],
    });

    expect(await service.findContactIdsByEmails(['Jané@example.com'])).toEqual({
      'jane@example.com': 'c1',
    });
    expect(connection.query.mock.calls[0][0]).toContain("'Jane@example.com'");
  });

  it('findEventParticipationCountByContactIds counts participations per contact', async () => {
    const { service, connection } = setup();

    expect(await service.findEventParticipationCountByContactIds([])).toEqual(
      {}
    );
    connection.query.mockResolvedValue({
      records: [
        { ContactId: 'c1', expr0: 3 },
        { ContactId: 'c2', expr0: 1 },
      ],
    });

    expect(
      await service.findEventParticipationCountByContactIds(['c1', 'c2'])
    ).toEqual({ c1: 3, c2: 1 });
  });

  it('findAllCampaignMembersByCampaignId filters by status when provided', async () => {
    const { service, connection } = setup();
    connection.query.mockResolvedValue({ records: [{ Id: 'cm' }] });

    expect(await service.findAllCampaignMembersByCampaignId('camp')).toEqual([
      { Id: 'cm' },
    ]);
    expect(connection.query.mock.calls[0][0]).not.toContain('AND Status');

    await service.findAllCampaignMembersByCampaignId(
      'camp',
      'Inscrit' as never
    );
    expect(connection.query.mock.calls[1][0]).toContain(
      "AND Status = 'Inscrit'"
    );
  });

  it('findBinomeByCandidateSfId and findTaskById return the first id', async () => {
    const { service, connection } = setup();
    connection.query.mockResolvedValueOnce({ records: [{ Id: 'b1' }] });
    connection.query.mockResolvedValueOnce({ records: [{ Id: 't1' }] });
    connection.query.mockResolvedValueOnce({ records: [] });

    expect(await service.findBinomeByCandidateSfId('cand')).toBe('b1');
    expect(await service.findTaskById('ext')).toBe('t1');
    expect(await service.findTaskById('ext2')).toBeUndefined();
  });
});
