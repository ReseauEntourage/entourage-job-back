import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { UserProps } from 'src/external-services/salesforce/salesforce.types';
import { UserRoles } from 'src/users/users.types';

// See tests/salesforce/find-contact.e2e-spec.ts for the rationale of exercising
// SalesforceService directly with mocked collaborators rather than through the API test
// harness (which doesn't set up a real Salesforce connection).
describe('SalesforceService.findOrCreateContactFromUserRegistrationForm - network/casquette', () => {
  const buildService = () => {
    const usersService = {
      updateSfContactId: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SalesforceService(
      usersService as never,
      {} as never // slackService, unused by this method
    );

    const updateContactCasquetteAndAppIdSpy = jest
      .spyOn(service, 'updateContactCasquetteAndAppId')
      .mockResolvedValue('updated-id');
    jest
      .spyOn(service, 'updateContactSocialSituation')
      .mockResolvedValue('updated-id');

    return { service, updateContactCasquetteAndAppIdSpy, usersService };
  };

  const baseUserProps: UserProps = {
    birthDate: new Date('1990-01-01'),
    department: 'Paris (75)' as never,
    email: 'user@example.com',
    firstName: 'Jane',
    id: 'user-1',
    lastName: 'Doe',
    phone: '0600000000',
    role: UserRoles.COACH,
  };

  it('adds LinkedOut to an existing Reseaux__c without removing the other network', async () => {
    const { service, updateContactCasquetteAndAppIdSpy } = buildService();
    jest.spyOn(service, 'findContact').mockResolvedValue({
      Id: 'contact-1',
      Casquettes_r_les__c: [],
      Reseaux__c: ['Entourage Local'],
    });

    await service.findOrCreateContactFromUserRegistrationForm(baseUserProps);

    expect(updateContactCasquetteAndAppIdSpy).toHaveBeenCalledWith(
      'contact-1',
      expect.objectContaining({
        reseaux: ['Entourage Local', 'LinkedOut'],
      })
    );
  });

  it('does not duplicate LinkedOut when it is already present', async () => {
    const { service, updateContactCasquetteAndAppIdSpy } = buildService();
    jest.spyOn(service, 'findContact').mockResolvedValue({
      Id: 'contact-2',
      Casquettes_r_les__c: [],
      Reseaux__c: ['LinkedOut'],
    });

    await service.findOrCreateContactFromUserRegistrationForm(baseUserProps);

    expect(updateContactCasquetteAndAppIdSpy).toHaveBeenCalledWith(
      'contact-2',
      expect.objectContaining({
        reseaux: ['LinkedOut'],
      })
    );
  });

  it('mirrors sfContactId on the user after creating a brand new contact', async () => {
    const { service, usersService } = buildService();
    jest.spyOn(service, 'findContact').mockResolvedValue(null);
    jest.spyOn(service, 'findLead').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'findOrCreateHouseholdAccount')
      .mockResolvedValue('account-1');
    jest.spyOn(service, 'createContact').mockResolvedValue('contact-new');

    await service.findOrCreateContactFromUserRegistrationForm(baseUserProps);

    expect(usersService.updateSfContactId).toHaveBeenCalledWith(
      'user-1',
      'contact-new'
    );
  });

  it('adds the Coach casquette without removing an existing casquette', async () => {
    const { service, updateContactCasquetteAndAppIdSpy } = buildService();
    jest.spyOn(service, 'findContact').mockResolvedValue({
      Id: 'contact-3',
      Casquettes_r_les__c: ['PRO Prescripteur' as never],
      Reseaux__c: ['LinkedOut'],
    });

    await service.findOrCreateContactFromUserRegistrationForm(baseUserProps);

    expect(updateContactCasquetteAndAppIdSpy).toHaveBeenCalledWith(
      'contact-3',
      expect.objectContaining({
        casquettes: ['PRO Prescripteur', 'PRO Coach Coup de pouce'],
      })
    );
  });
});
