import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';

// See tests/salesforce/find-contact.e2e-spec.ts for the rationale of exercising
// SalesforceService directly with mocked collaborators.
describe('SalesforceService.linkContactManually', () => {
  const buildService = (opts: {
    contact?: { Id: string; ID_App_Entourage_Pro__c?: string } | null;
    user?: { id: string; sfContactId?: string } | null;
  }) => {
    const slackService = {
      sendTechnicalMonitoringMessage: jest.fn().mockResolvedValue(undefined),
    };
    const usersService = {
      findByIdForSalesforceManualLink: jest
        .fn()
        .mockResolvedValue(opts.user ?? null),
      updateSfContactId: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SalesforceService(
      usersService as never,
      slackService as never
    );

    const findContactByIdSpy = jest
      .spyOn(service, 'findContactById')
      .mockResolvedValue(opts.contact ?? null);
    const repairContactAppIdSpy = jest
      .spyOn(service, 'repairContactAppId')
      .mockResolvedValue(undefined);

    return {
      service,
      slackService,
      usersService,
      findContactByIdSpy,
      repairContactAppIdSpy,
    };
  };

  it('links a user to a contact that is not linked to anyone yet', async () => {
    const { service, repairContactAppIdSpy } = buildService({
      contact: { Id: 'contact-1' },
      user: { id: 'user-1' },
    });

    const status = await service.linkContactManually('user-1', 'contact-1');

    expect(status).toBe('linked');
    expect(repairContactAppIdSpy).toHaveBeenCalledWith('contact-1', 'user-1');
  });

  it('reports already_linked without writing anything when both sides already match', async () => {
    const { service, repairContactAppIdSpy } = buildService({
      contact: { Id: 'contact-1', ID_App_Entourage_Pro__c: 'user-1' },
      user: { id: 'user-1', sfContactId: 'contact-1' },
    });

    const status = await service.linkContactManually('user-1', 'contact-1');

    expect(status).toBe('already_linked');
    expect(repairContactAppIdSpy).not.toHaveBeenCalled();
  });

  it('mirrors sfContactId when the Salesforce side is correct but Postgres is not yet caught up', async () => {
    const { service, repairContactAppIdSpy } = buildService({
      contact: { Id: 'contact-1', ID_App_Entourage_Pro__c: 'user-1' },
      user: { id: 'user-1' },
    });

    const status = await service.linkContactManually('user-1', 'contact-1');

    expect(status).toBe('linked');
    expect(repairContactAppIdSpy).toHaveBeenCalledWith('contact-1', 'user-1');
  });

  it('refuses and alerts Slack when the contact is already linked to a different user', async () => {
    const { service, slackService, repairContactAppIdSpy } = buildService({
      contact: { Id: 'contact-1', ID_App_Entourage_Pro__c: 'other-user' },
      user: { id: 'user-1' },
    });

    const status = await service.linkContactManually('user-1', 'contact-1');

    expect(status).toBe('contact_already_linked_to_another_user');
    expect(repairContactAppIdSpy).not.toHaveBeenCalled();
    expect(slackService.sendTechnicalMonitoringMessage).toHaveBeenCalledWith(
      false,
      expect.stringContaining('déjà lié à un autre utilisateur'),
      expect.anything()
    );
  });

  it('refuses and alerts Slack when the user is already linked to a different contact', async () => {
    const { service, slackService, repairContactAppIdSpy } = buildService({
      contact: { Id: 'contact-1' },
      user: { id: 'user-1', sfContactId: 'contact-other' },
    });

    const status = await service.linkContactManually('user-1', 'contact-1');

    expect(status).toBe('user_already_linked_to_another_contact');
    expect(repairContactAppIdSpy).not.toHaveBeenCalled();
    expect(slackService.sendTechnicalMonitoringMessage).toHaveBeenCalledWith(
      false,
      expect.stringContaining('déjà lié à un autre Contact Salesforce'),
      expect.anything()
    );
  });

  it('returns user_not_found without calling Salesforce write methods', async () => {
    const { service, repairContactAppIdSpy } = buildService({
      contact: { Id: 'contact-1' },
      user: null,
    });

    const status = await service.linkContactManually(
      'unknown-user',
      'contact-1'
    );

    expect(status).toBe('user_not_found');
    expect(repairContactAppIdSpy).not.toHaveBeenCalled();
  });

  it('returns contact_not_found without looking up the user', async () => {
    const { service, usersService, repairContactAppIdSpy } = buildService({
      contact: null,
    });

    const status = await service.linkContactManually(
      'user-1',
      'unknown-contact'
    );

    expect(status).toBe('contact_not_found');
    expect(usersService.findByIdForSalesforceManualLink).not.toHaveBeenCalled();
    expect(repairContactAppIdSpy).not.toHaveBeenCalled();
  });
});
