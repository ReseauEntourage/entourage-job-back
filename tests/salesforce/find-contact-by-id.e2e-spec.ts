import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';

// See tests/salesforce/find-contact.e2e-spec.ts for the rationale of exercising
// SalesforceService directly with a mocked jsforce connection.
describe('SalesforceService.findContactById', () => {
  const buildService = () => {
    const service = new SalesforceService(
      {} as never, // usersService, unused by this method
      {} as never // slackService, unused by this method
    );

    (
      service as unknown as { checkIfConnected: () => Promise<void> }
    ).checkIfConnected = jest.fn().mockResolvedValue(undefined);

    const query = jest.fn();
    (service as unknown as { salesforce: { query: typeof query } }).salesforce =
      {
        query,
      };

    return { service, query };
  };

  it('returns the contact when found', async () => {
    const { service, query } = buildService();
    query.mockResolvedValueOnce({
      records: [{ Id: 'contact-1', ID_App_Entourage_Pro__c: 'user-1' }],
    });

    const result = await service.findContactById('contact-1');

    expect(result).toEqual({
      Id: 'contact-1',
      ID_App_Entourage_Pro__c: 'user-1',
    });
    expect(query.mock.calls[0][0]).toContain("WHERE Id = 'contact-1'");
  });

  it('returns null when no contact matches the given id', async () => {
    const { service, query } = buildService();
    query.mockResolvedValueOnce({ records: [] });

    const result = await service.findContactById('unknown-id');

    expect(result).toBeNull();
  });
});
