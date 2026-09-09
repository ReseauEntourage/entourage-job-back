import { UserRoles } from 'src/users/users.types';
import { buildCronTasksProcessor } from 'tests/queues/build-cron-tasks-processor.helper';

describe('CronTasksProcessor.backfillSalesforceAppId', () => {
  const buildProcessor = (
    users: { email: string; id: string; role?: string }[],
    findContactsByEmailForBackfill: jest.Mock
  ) => {
    const usersService = {
      getActiveUsersForSalesforceAppIdBackfill: jest
        .fn()
        .mockResolvedValue(users),
      updateSfContactId: jest.fn().mockResolvedValue(undefined),
    };
    const salesforceService = {
      findContactsByEmailForBackfill,
      repairContactAppId: jest.fn().mockResolvedValue(undefined),
      completeContactNetworkAndCasquette: jest
        .fn()
        .mockResolvedValue({ networkAdded: false, casquetteAdded: null }),
    };
    const cronTasksSlackReporterService = {
      sendCronTaskResultToSlack: jest.fn().mockResolvedValue(undefined),
    };
    const slackService = {
      sendTechnicalMonitoringMessage: jest.fn().mockResolvedValue(undefined),
    };

    const processor = buildCronTasksProcessor({
      usersService: usersService as never,
      salesforceService: salesforceService as never,
      cronTasksSlackReporterService: cronTasksSlackReporterService as never,
      slackService: slackService as never,
    });

    return {
      processor,
      usersService,
      salesforceService,
      cronTasksSlackReporterService,
      slackService,
    };
  };

  it('repairs the contact of a user with a single, unlinked candidate and details the change in the report', async () => {
    const users = [
      { id: 'user-1', email: 'user1@example.com', role: UserRoles.COACH },
    ];
    const findContactsByEmailForBackfill = jest
      .fn()
      .mockResolvedValue([{ Id: 'contact-1' }]);
    const { processor, salesforceService, cronTasksSlackReporterService } =
      buildProcessor(users, findContactsByEmailForBackfill);

    await processor.backfillSalesforceAppId();

    expect(salesforceService.repairContactAppId).toHaveBeenCalledWith(
      'contact-1',
      'user-1'
    );
    expect(
      cronTasksSlackReporterService.sendCronTaskResultToSlack
    ).toHaveBeenCalledWith(
      true,
      expect.stringContaining('Backfill Salesforce'),
      { total: 1, success: 1, failure: 0 },
      [],
      undefined,
      undefined,
      [
        {
          label: 'Contacts Salesforce modifiés',
          items: [
            expect.stringContaining(
              'user-1 (user1@example.com) → contact contact-1: ID_App_Entourage_Pro__c renseigné (user-1)'
            ),
          ],
        },
        { label: 'Cas remontés pour revue manuelle', items: [] },
      ],
      [{ label: 'Already up to date', value: 0 }]
    );
  });

  it('details the network and casquette added on a safe correction', async () => {
    const users = [
      {
        id: 'user-1',
        email: 'user1@example.com',
        role: UserRoles.CANDIDATE,
      },
    ];
    const candidate = { Id: 'contact-1', Reseaux__c: 'Entourage Local' };
    const findContactsByEmailForBackfill = jest
      .fn()
      .mockResolvedValue([candidate]);
    const { processor, salesforceService, cronTasksSlackReporterService } =
      buildProcessor(users, findContactsByEmailForBackfill);
    salesforceService.completeContactNetworkAndCasquette.mockResolvedValue({
      networkAdded: true,
      casquetteAdded: 'PRO Candidat Coup de pouce',
    });

    await processor.backfillSalesforceAppId();

    expect(
      salesforceService.completeContactNetworkAndCasquette
    ).toHaveBeenCalledWith(candidate, 'PRO Candidat Coup de pouce');

    const [, , , , , , sections] =
      cronTasksSlackReporterService.sendCronTaskResultToSlack.mock.calls[0];
    const modifiedSection = sections.find(
      (section: { label: string }) =>
        section.label === 'Contacts Salesforce modifiés'
    );
    expect(modifiedSection.items[0]).toContain(
      'user-1 (user1@example.com) → contact contact-1'
    );
    expect(modifiedSection.items[0]).toContain('réseau LinkedOut ajouté');
    expect(modifiedSection.items[0]).toContain(
      `casquette ${UserRoles.CANDIDATE} ajoutée`
    );
  });

  it('details the network/casquette completion on every contact already linked to the user', async () => {
    const users = [
      { id: 'user-1', email: 'user1@example.com', role: UserRoles.COACH },
    ];
    const linkedCandidates = [
      { Id: 'contact-1', ID_App_Entourage_Pro__c: 'user-1' },
      { Id: 'contact-2', ID_App_Entourage_Pro__c: 'user-1' },
    ];
    const findContactsByEmailForBackfill = jest
      .fn()
      .mockResolvedValue(linkedCandidates);
    const { processor, salesforceService, cronTasksSlackReporterService } =
      buildProcessor(users, findContactsByEmailForBackfill);
    salesforceService.completeContactNetworkAndCasquette.mockResolvedValue({
      networkAdded: true,
      casquetteAdded: null,
    });

    await processor.backfillSalesforceAppId();

    expect(salesforceService.repairContactAppId).not.toHaveBeenCalled();
    expect(
      salesforceService.completeContactNetworkAndCasquette
    ).toHaveBeenCalledTimes(2);
    expect(
      salesforceService.completeContactNetworkAndCasquette
    ).toHaveBeenCalledWith(linkedCandidates[0], 'PRO Coach Coup de pouce');
    expect(
      salesforceService.completeContactNetworkAndCasquette
    ).toHaveBeenCalledWith(linkedCandidates[1], 'PRO Coach Coup de pouce');

    const [, , , , , , sections] =
      cronTasksSlackReporterService.sendCronTaskResultToSlack.mock.calls[0];
    const modifiedSection = sections.find(
      (section: { label: string }) =>
        section.label === 'Contacts Salesforce modifiés'
    );
    expect(modifiedSection.items).toHaveLength(2);
    expect(modifiedSection.items[0]).toContain('contact contact-1');
    expect(modifiedSection.items[1]).toContain('contact contact-2');
  });

  it('mirrors sfContactId on Postgres for an already-linked user, even with nothing else to fix', async () => {
    const users = [
      { id: 'user-1', email: 'user1@example.com', role: UserRoles.COACH },
    ];
    const linkedCandidates = [
      { Id: 'contact-1', ID_App_Entourage_Pro__c: 'user-1' },
    ];
    const findContactsByEmailForBackfill = jest
      .fn()
      .mockResolvedValue(linkedCandidates);
    const { processor, usersService } = buildProcessor(
      users,
      findContactsByEmailForBackfill
    );

    await processor.backfillSalesforceAppId();

    expect(usersService.updateSfContactId).toHaveBeenCalledWith(
      'user-1',
      'contact-1'
    );
  });

  it('counts a user as already up to date when already_linked and nothing was missing', async () => {
    const users = [
      { id: 'user-1', email: 'user1@example.com', role: UserRoles.COACH },
    ];
    const linkedCandidates = [
      { Id: 'contact-1', ID_App_Entourage_Pro__c: 'user-1' },
    ];
    const findContactsByEmailForBackfill = jest
      .fn()
      .mockResolvedValue(linkedCandidates);
    const { processor, cronTasksSlackReporterService } = buildProcessor(
      users,
      findContactsByEmailForBackfill
    );

    await processor.backfillSalesforceAppId();

    const [, , , , , , sections, extraCounts] =
      cronTasksSlackReporterService.sendCronTaskResultToSlack.mock.calls[0];
    const modifiedSection = sections.find(
      (section: { label: string }) =>
        section.label === 'Contacts Salesforce modifiés'
    );
    expect(modifiedSection.items).toHaveLength(0);
    expect(extraCounts).toEqual([{ label: 'Already up to date', value: 1 }]);
  });

  it('does not count a user as already up to date when a completion was applied', async () => {
    const users = [
      { id: 'user-1', email: 'user1@example.com', role: UserRoles.COACH },
    ];
    const linkedCandidates = [
      { Id: 'contact-1', ID_App_Entourage_Pro__c: 'user-1' },
    ];
    const findContactsByEmailForBackfill = jest
      .fn()
      .mockResolvedValue(linkedCandidates);
    const { processor, salesforceService, cronTasksSlackReporterService } =
      buildProcessor(users, findContactsByEmailForBackfill);
    salesforceService.completeContactNetworkAndCasquette.mockResolvedValue({
      networkAdded: true,
      casquetteAdded: null,
    });

    await processor.backfillSalesforceAppId();

    const [, , , , , , , extraCounts] =
      cronTasksSlackReporterService.sendCronTaskResultToSlack.mock.calls[0];
    expect(extraCounts).toEqual([{ label: 'Already up to date', value: 0 }]);
  });

  it('never creates a contact and reports ambiguous/not-found cases for manual review instead of correcting them', async () => {
    const users = [
      { id: 'user-shared', email: 'shared@example.com' },
      { id: 'user-missing', email: 'missing@example.com' },
    ];
    const findContactsByEmailForBackfill = jest
      .fn()
      .mockResolvedValueOnce([
        { Id: 'contact-shared', ID_App_Entourage_Pro__c: 'other-user' },
      ])
      .mockResolvedValueOnce([]);
    const { processor, salesforceService, cronTasksSlackReporterService } =
      buildProcessor(users, findContactsByEmailForBackfill);

    await processor.backfillSalesforceAppId();

    expect(salesforceService.repairContactAppId).not.toHaveBeenCalled();
    expect(
      cronTasksSlackReporterService.sendCronTaskResultToSlack
    ).toHaveBeenCalledWith(
      true,
      expect.stringContaining('Backfill Salesforce'),
      { total: 2, success: 0, failure: 0 },
      [],
      undefined,
      undefined,
      [
        { label: 'Contacts Salesforce modifiés', items: [] },
        {
          label: 'Cas remontés pour revue manuelle',
          items: [
            expect.stringContaining('user-shared'),
            expect.stringContaining('user-missing'),
          ],
        },
      ],
      [{ label: 'Already up to date', value: 0 }]
    );
  });

  it('sends an immediate alert distinct from the final report when a batch hits an unexpected error', async () => {
    const users = [{ id: 'user-1', email: 'user1@example.com' }];
    const findContactsByEmailForBackfill = jest
      .fn()
      .mockRejectedValue(new Error('Salesforce API unavailable'));
    const { processor, cronTasksSlackReporterService, slackService } =
      buildProcessor(users, findContactsByEmailForBackfill);

    await processor.backfillSalesforceAppId();

    expect(slackService.sendTechnicalMonitoringMessage).toHaveBeenCalledWith(
      false,
      expect.stringContaining('Erreur inattendue'),
      expect.anything()
    );
    expect(
      cronTasksSlackReporterService.sendCronTaskResultToSlack
    ).toHaveBeenCalledWith(
      false,
      expect.stringContaining('Backfill Salesforce'),
      { total: 1, success: 0, failure: 1 },
      [expect.objectContaining({ itemId: 'user-1' })],
      undefined,
      undefined,
      [
        { label: 'Contacts Salesforce modifiés', items: [] },
        { label: 'Cas remontés pour revue manuelle', items: [] },
      ],
      [{ label: 'Already up to date', value: 0 }]
    );
  });
});
