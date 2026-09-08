import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { UserProps } from 'src/external-services/salesforce/salesforce.types';
import { UserRoles } from 'src/users/users.types';

// See tests/salesforce/find-contact.e2e-spec.ts for the rationale of exercising
// SalesforceService directly with mocked collaborators. This covers the referrer's Salesforce
// Contact id resolution (ContactProps.refererId / TS_prescripteur__c) from their Postgres
// User.id, introduced to replace a plain email-based lookup.
describe('SalesforceService.findOrCreateContactFromUserRegistrationForm - referer resolution', () => {
  const baseUserProps: UserProps = {
    birthDate: new Date('1990-01-01'),
    department: 'Paris (75)' as never,
    email: 'user@example.com',
    firstName: 'Jane',
    id: 'user-1',
    lastName: 'Doe',
    phone: '0600000000',
    refererId: 'referer-1',
    role: UserRoles.CANDIDATE,
  };

  const buildService = () => {
    const usersService = {
      findOneWithAttributes: jest.fn(),
      updateSfContactId: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SalesforceService(
      usersService as never,
      {} as never // slackService, unused by this method
    );

    // The registering user has no existing contact - forces the create branch, where
    // ContactProps.refererId is actually consumed.
    jest.spyOn(service, 'findContact').mockImplementation(async (email) => {
      if (email === baseUserProps.email) {
        return null;
      }
      return null;
    });
    jest.spyOn(service, 'findLead').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'findOrCreateHouseholdAccount')
      .mockResolvedValue('account-1');
    const createContactSpy = jest
      .spyOn(service, 'createContact')
      .mockResolvedValue('contact-new');

    return { service, usersService, createContactSpy };
  };

  it('uses the referer sfContactId mirror without a live Salesforce lookup when populated', async () => {
    const { service, usersService, createContactSpy } = buildService();
    usersService.findOneWithAttributes.mockResolvedValue({
      id: 'referer-1',
      email: 'referer@example.com',
      sfContactId: 'referer-contact-mirrored',
    });
    const findContactSpy = jest.spyOn(service, 'findContact');

    await service.findOrCreateContactFromUserRegistrationForm(baseUserProps);

    expect(createContactSpy).toHaveBeenCalledWith(
      expect.objectContaining({ refererId: 'referer-contact-mirrored' }),
      expect.anything()
    );
    // Only the registering user's own contact is looked up - not the referer's, since the
    // mirror already had the answer.
    expect(findContactSpy).toHaveBeenCalledTimes(1);
    expect(findContactSpy).toHaveBeenCalledWith(
      baseUserProps.email,
      undefined,
      baseUserProps.id
    );
  });

  it('falls back to a live Salesforce lookup by appId/email when the mirror is empty', async () => {
    const { service, usersService, createContactSpy } = buildService();
    usersService.findOneWithAttributes.mockResolvedValue({
      id: 'referer-1',
      email: 'referer@example.com',
      sfContactId: null,
    });
    jest
      .spyOn(service, 'findContact')
      .mockImplementation(async (email, _recordType, appId) => {
        if (email === 'referer@example.com') {
          expect(appId).toBe('referer-1');
          return {
            Id: 'referer-contact-live',
            Casquettes_r_les__c: [],
            Reseaux__c: [],
          };
        }
        return null;
      });

    await service.findOrCreateContactFromUserRegistrationForm(baseUserProps);

    expect(createContactSpy).toHaveBeenCalledWith(
      expect.objectContaining({ refererId: 'referer-contact-live' }),
      expect.anything()
    );
  });

  it('leaves refererId undefined when the referer cannot be found in Postgres', async () => {
    const { service, usersService, createContactSpy } = buildService();
    usersService.findOneWithAttributes.mockResolvedValue(null);

    await service.findOrCreateContactFromUserRegistrationForm(baseUserProps);

    expect(createContactSpy).toHaveBeenCalledWith(
      expect.objectContaining({ refererId: undefined }),
      expect.anything()
    );
  });

  it('does not attempt any referer resolution when refererId is not provided', async () => {
    const { service, usersService, createContactSpy } = buildService();

    await service.findOrCreateContactFromUserRegistrationForm({
      ...baseUserProps,
      refererId: undefined,
    });

    expect(usersService.findOneWithAttributes).not.toHaveBeenCalled();
    expect(createContactSpy).toHaveBeenCalledWith(
      expect.objectContaining({ refererId: undefined }),
      expect.anything()
    );
  });
});
