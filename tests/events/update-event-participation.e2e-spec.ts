import { EventsService } from 'src/events/events.service';

// EventsService talks to Salesforce via SalesforceService, which the API test harness doesn't
// set up. This exercises updateEventParticipation() directly with mocked collaborators.
describe('EventsService.updateEventParticipation', () => {
  const buildService = () => {
    const salesforceService = {
      findEventCampaignById: jest.fn().mockResolvedValue({ Id: 'campaign-1' }),
      findContact: jest.fn().mockResolvedValue({ Id: 'contact-1' }),
      createOrUpdateCampaignMember: jest.fn().mockResolvedValue(undefined),
    };

    const service = new EventsService(
      salesforceService as never,
      {} as never, // departmentsService, unused by this method
      {} as never // usersService, unused by this method
    );

    return { service, salesforceService };
  };

  it('resolves the Salesforce contact by userId rather than email alone', async () => {
    const { service, salesforceService } = buildService();

    await service.updateEventParticipation(
      'user@example.com',
      'event-1',
      true,
      'user-1'
    );

    expect(salesforceService.findContact).toHaveBeenCalledWith(
      'user@example.com',
      undefined,
      'user-1'
    );
    expect(salesforceService.findEventCampaignById).toHaveBeenCalledWith(
      'user@example.com',
      'event-1',
      'user-1'
    );
  });

  it('registers the resolved contact as a campaign member', async () => {
    const { service, salesforceService } = buildService();

    await service.updateEventParticipation(
      'user@example.com',
      'event-1',
      true,
      'user-1'
    );

    expect(salesforceService.createOrUpdateCampaignMember).toHaveBeenCalledWith(
      { contactId: 'contact-1' },
      'campaign-1',
      'Inscrit'
    );
  });

  it('throws when the contact cannot be found', async () => {
    const { service, salesforceService } = buildService();
    salesforceService.findContact.mockResolvedValue(null);

    await expect(
      service.updateEventParticipation(
        'user@example.com',
        'event-1',
        true,
        'user-1'
      )
    ).rejects.toThrow(
      'Contact with email user@example.com not found in Salesforce'
    );
  });
});
