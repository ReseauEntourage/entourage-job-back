import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';

// SalesforceService talks to a real Salesforce org via jsforce, which the API test harness
// doesn't set up. This exercises findContact() directly with a mocked jsforce connection and
// mocked collaborators, following the pattern used for CronTasksProcessor unit tests.
describe('SalesforceService.findContact', () => {
  const buildService = () => {
    const slackService = {
      sendTechnicalMonitoringMessage: jest.fn().mockResolvedValue(undefined),
    };
    const usersService = {
      updateSfContactId: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SalesforceService(
      usersService as never,
      slackService as never
    );

    (
      service as unknown as { checkIfConnected: () => Promise<void> }
    ).checkIfConnected = jest.fn().mockResolvedValue(undefined);

    const query = jest.fn();
    (service as unknown as { salesforce: { query: typeof query } }).salesforce =
      {
        query,
      };

    const updateRecordSpy = jest
      .spyOn(service, 'updateRecord')
      .mockResolvedValue('updated-id');

    return { service, query, slackService, updateRecordSpy, usersService };
  };

  it('looks up by appId first and returns without querying by email when found', async () => {
    const { service, query, usersService } = buildService();
    query.mockResolvedValueOnce({
      records: [{ Id: 'contact-1', Casquettes_r_les__c: 'Coach' }],
    });

    const result = await service.findContact(
      'user@example.com',
      undefined,
      'user-1'
    );

    expect(result).toEqual({
      Id: 'contact-1',
      Casquettes_r_les__c: ['Coach'],
      Reseaux__c: [],
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('ID_App_Entourage_Pro__c');
    expect(usersService.updateSfContactId).toHaveBeenCalledWith(
      'user-1',
      'contact-1'
    );
  });

  it('falls back to email lookup when the appId query finds nothing', async () => {
    const { service, query } = buildService();
    query
      .mockResolvedValueOnce({ records: [] }) // appId lookup
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'contact-2',
            Casquettes_r_les__c: '',
            ID_App_Entourage_Pro__c: 'user-1',
          },
        ],
      });

    const result = await service.findContact(
      'user@example.com',
      undefined,
      'user-1'
    );

    expect(result).toEqual({
      Id: 'contact-2',
      Casquettes_r_les__c: [],
      Reseaux__c: [],
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain('Email =');
  });

  it('repairs ID_App_Entourage_Pro__c when the email fallback finds a contact with an empty id', async () => {
    const { service, query, updateRecordSpy, usersService } = buildService();
    query
      .mockResolvedValueOnce({ records: [] }) // appId lookup
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'contact-3',
            Casquettes_r_les__c: '',
            ID_App_Entourage_Pro__c: undefined,
          },
        ],
      });

    await service.findContact('user@example.com', undefined, 'user-1');

    expect(updateRecordSpy).toHaveBeenCalledWith(
      'Contact',
      expect.objectContaining({
        Id: 'contact-3',
        ID_App_Entourage_Pro__c: 'user-1',
      })
    );
    expect(usersService.updateSfContactId).toHaveBeenCalledWith(
      'user-1',
      'contact-3'
    );
  });

  it('does not overwrite ID_App_Entourage_Pro__c when already linked to a different user, and alerts Slack', async () => {
    const { service, query, updateRecordSpy, slackService, usersService } =
      buildService();
    query
      .mockResolvedValueOnce({ records: [] }) // appId lookup
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'contact-4',
            Casquettes_r_les__c: '',
            ID_App_Entourage_Pro__c: 'other-user',
          },
        ],
      });

    const result = await service.findContact(
      'user@example.com',
      undefined,
      'user-1'
    );

    expect(result).toBeNull();
    expect(updateRecordSpy).not.toHaveBeenCalled();
    expect(slackService.sendTechnicalMonitoringMessage).toHaveBeenCalled();
    expect(usersService.updateSfContactId).not.toHaveBeenCalled();
  });

  it('still returns null on the guard-rail case even when the Slack alert itself fails', async () => {
    const { service, query, slackService } = buildService();
    slackService.sendTechnicalMonitoringMessage.mockRejectedValue(
      new Error('Slack is down')
    );
    query
      .mockResolvedValueOnce({ records: [] }) // appId lookup
      .mockResolvedValueOnce({
        records: [
          {
            Id: 'contact-4',
            Casquettes_r_les__c: '',
            ID_App_Entourage_Pro__c: 'other-user',
          },
        ],
      });

    // Must not throw: a Slack outage is a monitoring side channel, not a reason to break
    // Salesforce contact resolution for the end user.
    const result = await service.findContact(
      'user@example.com',
      undefined,
      'user-1'
    );

    expect(result).toBeNull();
  });

  it('parses an existing multi-value Reseaux__c into an array', async () => {
    const { service, query } = buildService();
    query.mockResolvedValueOnce({
      records: [
        {
          Id: 'contact-6',
          Casquettes_r_les__c: 'Candidat',
          Reseaux__c: 'Entourage Local;LinkedOut',
        },
      ],
    });

    const result = await service.findContact('user@example.com');

    expect(result).toEqual({
      Id: 'contact-6',
      Casquettes_r_les__c: ['Candidat'],
      Reseaux__c: ['Entourage Local', 'LinkedOut'],
    });
  });

  it('preserves the email-only behavior when no appId is provided', async () => {
    const { service, query, updateRecordSpy } = buildService();
    query.mockResolvedValueOnce({
      records: [{ Id: 'contact-5', Casquettes_r_les__c: 'Candidat' }],
    });

    const result = await service.findContact('user@example.com');

    expect(result).toEqual({
      Id: 'contact-5',
      Casquettes_r_les__c: ['Candidat'],
      Reseaux__c: [],
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('Email =');
    expect(updateRecordSpy).not.toHaveBeenCalled();
  });
});
