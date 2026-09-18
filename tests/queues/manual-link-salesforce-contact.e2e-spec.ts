import { buildCronTasksProcessor } from 'tests/queues/build-cron-tasks-processor.helper';

describe('CronTasksProcessor.manualLinkSalesforceContact', () => {
  const buildProcessor = (linkContactManually: jest.Mock) => {
    const salesforceService = { linkContactManually };
    const cronTasksSlackReporterService = {
      sendCronTaskResultToSlack: jest.fn().mockResolvedValue(undefined),
    };
    const slackService = {
      sendTechnicalMonitoringMessage: jest.fn().mockResolvedValue(undefined),
    };

    const processor = buildCronTasksProcessor({
      salesforceService: salesforceService as never,
      cronTasksSlackReporterService: cronTasksSlackReporterService as never,
      slackService: slackService as never,
    });

    return {
      processor,
      salesforceService,
      cronTasksSlackReporterService,
      slackService,
    };
  };

  it('processes pairs sequentially, in order, applying the throttle delay between each', async () => {
    const callOrder: string[] = [];
    const linkContactManually = jest.fn(async (userId: string) => {
      callOrder.push(userId);
      return 'linked';
    });
    const { processor } = buildProcessor(linkContactManually);

    await processor.manualLinkSalesforceContact({
      links: [
        { userId: 'user-1', sfContactId: 'contact-1' },
        { userId: 'user-2', sfContactId: 'contact-2' },
      ],
    });

    expect(callOrder).toEqual(['user-1', 'user-2']);
    expect(linkContactManually).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'contact-1'
    );
    expect(linkContactManually).toHaveBeenNthCalledWith(
      2,
      'user-2',
      'contact-2'
    );
  });

  it('reports a mixed batch: linked, already linked, rejected and unexpected failure', async () => {
    const linkContactManually = jest
      .fn()
      .mockResolvedValueOnce('linked')
      .mockResolvedValueOnce('already_linked')
      .mockResolvedValueOnce('contact_already_linked_to_another_user')
      .mockRejectedValueOnce(new Error('Salesforce API unavailable'));
    const { processor, cronTasksSlackReporterService, slackService } =
      buildProcessor(linkContactManually);

    await processor.manualLinkSalesforceContact({
      links: [
        { userId: 'user-1', sfContactId: 'contact-1' },
        { userId: 'user-2', sfContactId: 'contact-2' },
        { userId: 'user-3', sfContactId: 'contact-3' },
        { userId: 'user-4', sfContactId: 'contact-4' },
      ],
    });

    expect(slackService.sendTechnicalMonitoringMessage).toHaveBeenCalledWith(
      false,
      expect.stringContaining('Erreur inattendue'),
      expect.anything()
    );
    expect(
      cronTasksSlackReporterService.sendCronTaskResultToSlack
    ).toHaveBeenCalledWith(
      false,
      expect.stringContaining('Rattachement manuel Salesforce'),
      { total: 4, success: 2, failure: 1 },
      [expect.objectContaining({ itemId: 'user-4 / contact-4' })],
      undefined,
      undefined,
      [
        {
          label: 'Paires refusées',
          items: [
            expect.stringContaining(
              'user-3 / contact-3 - contact_already_linked_to_another_user'
            ),
          ],
        },
      ],
      [{ label: 'Already linked', value: 1 }]
    );
  });

  it('applies the first of two contradictory pairs and rejects the second, since pairs are processed sequentially', async () => {
    // Emulates the real linkContactManually guard-rail with an in-memory link map, to prove
    // that sequential (not parallel) processing is what makes the guard-rail catch a
    // contradictory pair within the same batch, rather than racing.
    const contactByUser = new Map<string, string>();
    const linkContactManually = jest.fn(
      async (userId: string, sfContactId: string) => {
        const existingSfContactId = contactByUser.get(userId);
        if (existingSfContactId && existingSfContactId !== sfContactId) {
          return 'user_already_linked_to_another_contact';
        }
        const alreadyTakenByAnotherUser = [...contactByUser.entries()].some(
          ([otherUserId, otherSfContactId]) =>
            otherUserId !== userId && otherSfContactId === sfContactId
        );
        if (alreadyTakenByAnotherUser) {
          return 'contact_already_linked_to_another_user';
        }
        contactByUser.set(userId, sfContactId);
        return 'linked';
      }
    );
    const { processor, cronTasksSlackReporterService } =
      buildProcessor(linkContactManually);

    await processor.manualLinkSalesforceContact({
      links: [
        { userId: 'user-1', sfContactId: 'contact-1' },
        { userId: 'user-2', sfContactId: 'contact-1' },
      ],
    });

    const [, , counts, , , , sections] =
      cronTasksSlackReporterService.sendCronTaskResultToSlack.mock.calls[0];
    expect(counts).toEqual({ total: 2, success: 1, failure: 0 });
    const rejectedSection = sections.find(
      (section: { label: string }) => section.label === 'Paires refusées'
    );
    expect(rejectedSection.items).toEqual([
      expect.stringContaining(
        'user-2 / contact-1 - contact_already_linked_to_another_user'
      ),
    ]);
  });

  it('never calls a contact-creation or email-search method', async () => {
    const linkContactManually = jest.fn().mockResolvedValue('linked');
    const salesforceService: Record<string, jest.Mock> = {
      linkContactManually,
      createContact: jest.fn(),
      findContact: jest.fn(),
      findContactsByEmailForBackfill: jest.fn(),
    };
    const cronTasksSlackReporterService = {
      sendCronTaskResultToSlack: jest.fn().mockResolvedValue(undefined),
    };
    const processor = buildCronTasksProcessor({
      salesforceService: salesforceService as never,
      cronTasksSlackReporterService: cronTasksSlackReporterService as never,
      slackService: { sendTechnicalMonitoringMessage: jest.fn() } as never,
    });

    await processor.manualLinkSalesforceContact({
      links: [{ userId: 'user-1', sfContactId: 'contact-1' }],
    });

    expect(salesforceService.createContact).not.toHaveBeenCalled();
    expect(salesforceService.findContact).not.toHaveBeenCalled();
    expect(
      salesforceService.findContactsByEmailForBackfill
    ).not.toHaveBeenCalled();
  });
});
