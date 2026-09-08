import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { UserRoles } from 'src/users/users.types';

// See tests/salesforce/find-contact.e2e-spec.ts for the rationale of exercising
// SalesforceService directly with mocked collaborators.
describe('SalesforceService.updateSalesforceUserCompany - network preservation', () => {
  const buildService = () => {
    const service = new SalesforceService(
      {} as never, // usersService, unused - findContactFromUserId is stubbed directly below
      {} as never // slackService, unused by this method
    );

    jest.spyOn(service, 'findContactFromUserId').mockResolvedValue({
      id: 'user-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '0600000000',
      department: 'Paris (75)' as never,
      role: UserRoles.COACH,
    });
    jest
      .spyOn(service, 'findOrCreateHouseholdAccount')
      .mockResolvedValue('household-account-id');
    const updateContactSpy = jest
      .spyOn(service, 'updateContact')
      .mockResolvedValue('contact-1');

    return { service, updateContactSpy };
  };

  it('preserves an existing network (e.g. Entourage Local) instead of overwriting Reseaux__c', async () => {
    const { service, updateContactSpy } = buildService();
    jest.spyOn(service, 'findContact').mockResolvedValue({
      Id: 'contact-1',
      Casquettes_r_les__c: [],
      Reseaux__c: ['Entourage Local'],
    });

    await service.updateSalesforceUserCompany('user-1', null);

    expect(updateContactSpy).toHaveBeenCalledWith(
      'contact-1',
      expect.objectContaining({
        reseaux: ['Entourage Local', 'LinkedOut'],
      }),
      expect.anything()
    );
  });

  it('does not duplicate LinkedOut when it is already present', async () => {
    const { service, updateContactSpy } = buildService();
    jest.spyOn(service, 'findContact').mockResolvedValue({
      Id: 'contact-1',
      Casquettes_r_les__c: [],
      Reseaux__c: ['LinkedOut'],
    });

    await service.updateSalesforceUserCompany('user-1', null);

    expect(updateContactSpy).toHaveBeenCalledWith(
      'contact-1',
      expect.objectContaining({
        reseaux: ['LinkedOut'],
      }),
      expect.anything()
    );
  });
});
