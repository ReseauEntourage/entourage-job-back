import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';

// See tests/salesforce/find-contact.e2e-spec.ts for the rationale of exercising
// SalesforceService directly with mocked collaborators.
describe('SalesforceService.repairContactAppId', () => {
  it('writes the app id on Salesforce and mirrors it on the user row', async () => {
    const usersService = {
      updateSfContactId: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SalesforceService(
      usersService as never,
      {} as never // slackService, unused by this method
    );
    const updateRecordSpy = jest
      .spyOn(service, 'updateRecord')
      .mockResolvedValue('contact-1');

    await service.repairContactAppId('contact-1', 'user-1');

    expect(updateRecordSpy).toHaveBeenCalledWith(
      'Contact',
      expect.objectContaining({
        Id: 'contact-1',
        ID_App_Entourage_Pro__c: 'user-1',
      })
    );
    expect(usersService.updateSfContactId).toHaveBeenCalledWith(
      'user-1',
      'contact-1'
    );
  });
});
