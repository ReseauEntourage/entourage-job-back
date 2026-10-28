import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';
import { WorkQueueProcessor } from 'src/queues/consumers/work-queue.processor';
import { Jobs } from 'src/queues/queues.types';

// The Vonage SDK is published as ESM only: it is never needed since VonageService
// is replaced by a double in this spec.
jest.mock('@vonage/server-sdk', () => ({ Vonage: jest.fn() }));
jest.mock('@vonage/messages', () => ({ Channels: { SMS: 'sms' } }));

const job = <T>(name: string, data: T) =>
  ({ id: 'job-1', name, data }) as never;

describe('WorkQueueProcessor', () => {
  const savedEnableSf = process.env.ENABLE_SF;

  const build = () => {
    const workQueue = { add: jest.fn().mockResolvedValue({ id: 'queued' }) };
    const mailjetService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
      createContact: jest.fn().mockResolvedValue(undefined),
      createContactForUser: jest.fn().mockResolvedValue(undefined),
    };
    const vonageService = { sendSms: jest.fn().mockResolvedValue(undefined) };
    const salesforceService = {
      createOrUpdateSalesforceUser: jest.fn().mockResolvedValue(undefined),
      createOrUpdateSalesforceCompany: jest.fn().mockResolvedValue(undefined),
      updateSalesforceUserCompany: jest
        .fn()
        .mockResolvedValue({ companyAccountNotFound: false }),
    };
    const companiesService = {
      findOne: jest.fn(),
      findOneByName: jest.fn(),
    };
    const usersService = {
      findOneWithRelations: jest.fn(),
      findOneByMailWithRelations: jest.fn(),
      findOneByMail: jest.fn(),
      generatePostOnboardingWelcomeMessage: jest.fn(),
      sendOnboardingCompletedMail: jest.fn().mockResolvedValue(undefined),
    };
    const userProfilesService = { findOneByUserId: jest.fn() };
    const messagingService = {
      createMessageWithConversation: jest.fn().mockResolvedValue(undefined),
    };
    const userProfileRecommendationsService = {
      retrieveOrComputeRecommendationsForUserIdIA: jest.fn(),
    };
    const slackService = {
      sendTechnicalMonitoringMessage: jest.fn().mockResolvedValue(undefined),
    };
    const helpGroupNotificationEmailsService = {
      sendNotificationEmail: jest
        .fn()
        .mockResolvedValue('help group mail sent'),
    };
    const communicationLogsService = {
      recordSent: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new WorkQueueProcessor(
      workQueue as never,
      mailjetService as never,
      vonageService as never,
      salesforceService as never,
      companiesService as never,
      usersService as never,
      userProfilesService as never,
      messagingService as never,
      userProfileRecommendationsService as never,
      slackService as never,
      helpGroupNotificationEmailsService as never,
      communicationLogsService as never
    );

    return {
      processor,
      workQueue,
      mailjetService,
      vonageService,
      salesforceService,
      companiesService,
      usersService,
      userProfilesService,
      messagingService,
      userProfileRecommendationsService,
      slackService,
      helpGroupNotificationEmailsService,
      communicationLogsService,
    };
  };

  afterEach(() => {
    if (savedEnableSf === undefined) {
      delete process.env.ENABLE_SF;
    } else {
      process.env.ENABLE_SF = savedEnableSf;
    }
  });

  describe('process (job dispatch)', () => {
    it.each([
      [Jobs.SEND_MAIL, 'processSendMail'],
      [Jobs.SEND_SMS, 'processSendSms'],
      [
        Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY,
        'processCreateOrUpdateSalesforceCompany',
      ],
      [
        Jobs.CREATE_OR_UPDATE_SALESFORCE_USER,
        'processCreateOrUpdateSalesforceUser',
      ],
      [
        Jobs.UPDATE_SALESFORCE_USER_COMPANY,
        'processUpdateSalesforceUserCompany',
      ],
      [Jobs.NEWSLETTER_SUBSCRIPTION, 'processNewsletterSubscription'],
      [Jobs.USER_NEWSLETTER_SUBSCRIPTION, 'processUserNewsletterSubscription'],
      [Jobs.SEND_STAFF_MESSAGING_MESSAGE, 'processSendStaffMessagingMessage'],
      [
        Jobs.BULK_SEND_STAFF_MESSAGING_MESSAGE,
        'processBulkSendStaffMessagingMessage',
      ],
      [Jobs.ON_ONBOARDING_COMPLETED, 'processOnOnboardingCompleted'],
    ])('routes the "%s" job to %s', async (name, method) => {
      const { processor } = build();
      const spy = jest
        .spyOn(processor, method as never)
        .mockResolvedValue('done' as never);

      const result = await processor.process(job(name, {}));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(result).toBe('done');
    });

    it('delegates the help group notification email job to its service', async () => {
      const { processor, helpGroupNotificationEmailsService } = build();
      const data = { helpGroupId: 'hg-1' };

      const result = await processor.process(
        job(Jobs.SEND_HELP_GROUP_NOTIFICATION_EMAIL, data)
      );

      expect(
        helpGroupNotificationEmailsService.sendNotificationEmail
      ).toHaveBeenCalledWith(data);
      expect(result).toBe('help group mail sent');
    });

    it('rejects an unknown job type', async () => {
      const { processor } = build();

      await expect(
        processor.process(job(Jobs.DELETE_INACTIVE_USERS, {}))
      ).rejects.toThrow(`Unknown job type: ${Jobs.DELETE_INACTIVE_USERS}`);
    });
  });

  describe('mail, SMS and newsletter jobs', () => {
    it('records in the communication history the mails sent to a user', async () => {
      const { processor, mailjetService, communicationLogsService } = build();
      const mail = {
        toEmail: 'a@example.org',
        templateId: MailjetTemplates.ACCOUNT_CREATED,
        userId: 'user-1',
        metadata: { authorId: 'author-1' },
      };
      mailjetService.sendMail.mockResolvedValue({
        body: {
          Messages: [{ Status: 'success', To: [{ MessageID: 123456789 }] }],
        },
      });

      await processor.processSendMail(job(Jobs.SEND_MAIL, mail));

      expect(communicationLogsService.recordSent).toHaveBeenCalledWith([
        {
          userId: 'user-1',
          channel: 'email',
          type: 'ACCOUNT_CREATED',
          metadata: { authorId: 'author-1' },
          providerMessageId: '123456789',
        },
      ]);
    });

    it('records a mail without provider id when Mailjet does not detail it', async () => {
      const { processor, communicationLogsService } = build();

      await processor.processSendMail(
        job(Jobs.SEND_MAIL, {
          toEmail: 'a@example.org',
          templateId: MailjetTemplates.ACCOUNT_CREATED,
          userId: 'user-1',
        })
      );

      expect(communicationLogsService.recordSent).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: 'user-1',
          providerMessageId: undefined,
        }),
      ]);
    });

    it('records nothing for a mail that targets no user', async () => {
      const { processor, communicationLogsService } = build();

      await processor.processSendMail(
        job(Jobs.SEND_MAIL, { toEmail: 'a@example.org', templateId: 42 })
      );

      expect(communicationLogsService.recordSent).toHaveBeenCalledWith([]);
    });

    it('records only the mails of a batch that Mailjet accepted', async () => {
      const { processor, mailjetService, communicationLogsService } = build();
      mailjetService.sendMail.mockResolvedValue({
        body: { Messages: [{ Status: 'success' }, { Status: 'error' }] },
      });
      const mails = [
        { toEmail: 'a@example.org', templateId: 1, userId: 'user-1' },
        { toEmail: 'b@example.org', templateId: 2, userId: 'user-2' },
      ];

      await processor.processSendMail(job(Jobs.SEND_MAIL, mails));

      expect(communicationLogsService.recordSent).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'user-1', type: '1' }),
      ]);
    });

    it('records nothing when Mailjet fails', async () => {
      const { processor, mailjetService, communicationLogsService } = build();
      mailjetService.sendMail.mockRejectedValue(new Error('mailjet down'));

      await expect(
        processor.processSendMail(
          job(Jobs.SEND_MAIL, {
            toEmail: 'a@example.org',
            templateId: 1,
            userId: 'user-1',
          })
        )
      ).rejects.toThrow('mailjet down');

      expect(communicationLogsService.recordSent).not.toHaveBeenCalled();
    });

    it('sends a single mail through Mailjet', async () => {
      const { processor, mailjetService } = build();
      const mail = { toEmail: 'a@example.org', templateId: 42 };

      const result = await processor.processSendMail(job(Jobs.SEND_MAIL, mail));

      expect(mailjetService.sendMail).toHaveBeenCalledWith([mail]);
      expect(result).toContain('a@example.org');
      expect(result).toContain('42');
    });

    it('sends several mails in a single Mailjet call', async () => {
      const { processor, mailjetService } = build();
      const mails = [
        { toEmail: 'a@example.org', templateId: 1 },
        { toEmail: 'b@example.org', templateId: 2 },
      ];

      const result = await processor.processSendMail(
        job(Jobs.SEND_MAIL, mails)
      );

      expect(mailjetService.sendMail).toHaveBeenCalledTimes(1);
      expect(mailjetService.sendMail).toHaveBeenCalledWith(mails);
      expect(result).toContain('b@example.org');
    });

    it('lets a Mailjet failure bubble up so that the job is retried', async () => {
      const { processor, mailjetService } = build();
      mailjetService.sendMail.mockRejectedValue(new Error('mailjet down'));

      await expect(
        processor.processSendMail(
          job(Jobs.SEND_MAIL, { toEmail: 'a@example.org', templateId: 1 })
        )
      ).rejects.toThrow('mailjet down');
    });

    it('sends an SMS through Vonage', async () => {
      const { processor, vonageService } = build();

      const result = await processor.processSendSms(
        job(Jobs.SEND_SMS, { to: '+33600000000', text: 'Hello' })
      );

      expect(vonageService.sendSms).toHaveBeenCalledWith(
        '+33600000000',
        'Hello'
      );
      expect(result).toBe('SMS sent to +33600000000');
    });

    it('records in the communication history the SMS sent to a user', async () => {
      const { processor, vonageService, communicationLogsService } = build();
      vonageService.sendSms.mockResolvedValue('vonage-uuid-1');

      await processor.processSendSms(
        job(Jobs.SEND_SMS, {
          to: '+33600000000',
          text: 'Hello',
          userId: 'user-1',
          type: 'UNANSWERED_CONVERSATION_REMINDER',
          metadata: { senderId: 'sender-1' },
        })
      );

      expect(communicationLogsService.recordSent).toHaveBeenCalledWith([
        {
          userId: 'user-1',
          channel: 'sms',
          type: 'UNANSWERED_CONVERSATION_REMINDER',
          metadata: { senderId: 'sender-1' },
          providerMessageId: 'vonage-uuid-1',
        },
      ]);
    });

    it('records nothing for an SMS that targets no user', async () => {
      const { processor, communicationLogsService } = build();

      await processor.processSendSms(
        job(Jobs.SEND_SMS, { to: '+33600000000', text: 'Hello' })
      );

      expect(communicationLogsService.recordSent).not.toHaveBeenCalled();
    });

    it('records nothing when Vonage fails', async () => {
      const { processor, vonageService, communicationLogsService } = build();
      vonageService.sendSms.mockRejectedValue(new Error('vonage down'));

      await expect(
        processor.processSendSms(
          job(Jobs.SEND_SMS, {
            to: '+33600000000',
            text: 'Hello',
            userId: 'user-1',
            type: 'UNANSWERED_CONVERSATION_REMINDER',
          })
        )
      ).rejects.toThrow('vonage down');

      expect(communicationLogsService.recordSent).not.toHaveBeenCalled();
    });

    it('subscribes a landing-page contact to the newsletter', async () => {
      const { processor, mailjetService } = build();
      const data = { email: 'visitor@example.org' };

      const result = await processor.processNewsletterSubscription(
        job(Jobs.NEWSLETTER_SUBSCRIPTION, data)
      );

      expect(mailjetService.createContact).toHaveBeenCalledWith(data);
      expect(result).toBe(
        "Contact 'visitor@example.org' subscribed to newsletter"
      );
    });

    it('creates the Mailjet contact of a registered user', async () => {
      const { processor, mailjetService } = build();

      const result = await processor.processUserNewsletterSubscription(
        job(Jobs.USER_NEWSLETTER_SUBSCRIPTION, {
          userId: 'user-1',
          source: 'registration',
        })
      );

      expect(mailjetService.createContactForUser).toHaveBeenCalledWith(
        'user-1',
        'registration'
      );
      expect(result).toContain('user-1');
    });
  });

  describe('Salesforce jobs', () => {
    describe('when Salesforce is disabled', () => {
      beforeEach(() => {
        process.env.ENABLE_SF = 'false';
      });

      it('ignores the user creation or update', async () => {
        const { processor, salesforceService, workQueue } = build();

        const result = await processor.processCreateOrUpdateSalesforceUser(
          job(Jobs.CREATE_OR_UPDATE_SALESFORCE_USER, { userId: 'u1' })
        );

        expect(result).toContain('ignored');
        expect(
          salesforceService.createOrUpdateSalesforceUser
        ).not.toHaveBeenCalled();
        expect(workQueue.add).not.toHaveBeenCalled();
      });

      it('ignores the company creation or update', async () => {
        const { processor, salesforceService } = build();

        const result = await processor.processCreateOrUpdateSalesforceCompany(
          job(Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY, { name: 'ACME' })
        );

        expect(result).toContain('ignored');
        expect(
          salesforceService.createOrUpdateSalesforceCompany
        ).not.toHaveBeenCalled();
      });

      it('ignores the user company update', async () => {
        const { processor, salesforceService } = build();

        const result = await processor.processUpdateSalesforceUserCompany(
          job(Jobs.UPDATE_SALESFORCE_USER_COMPANY, {
            userId: 'u1',
            companyId: 'c1',
          })
        );

        expect(result).toContain('ignored');
        expect(
          salesforceService.updateSalesforceUserCompany
        ).not.toHaveBeenCalled();
      });
    });

    describe('when Salesforce is enabled', () => {
      beforeEach(() => {
        process.env.ENABLE_SF = 'true';
      });

      it('creates the user in Salesforce without chaining any job when there is no company', async () => {
        const { processor, salesforceService, workQueue } = build();

        const result = await processor.processCreateOrUpdateSalesforceUser(
          job(Jobs.CREATE_OR_UPDATE_SALESFORCE_USER, {
            userId: 'u1',
            campaign: 'camp',
            companyRole: 'CEO',
          })
        );

        expect(
          salesforceService.createOrUpdateSalesforceUser
        ).toHaveBeenCalledWith(
          'u1',
          expect.objectContaining({ campaign: 'camp', position: 'CEO' })
        );
        expect(workQueue.add).not.toHaveBeenCalled();
        expect(result).toBe("Salesforce : created or updated user 'u1'");
      });

      it('chains the company creation when the user is the company admin', async () => {
        const { processor, companiesService, workQueue } = build();
        companiesService.findOne.mockResolvedValue({ name: 'ACME' });

        await processor.processCreateOrUpdateSalesforceUser(
          job(Jobs.CREATE_OR_UPDATE_SALESFORCE_USER, {
            userId: 'u1',
            companyId: 'c1',
            isCompanyAdmin: true,
          })
        );

        expect(workQueue.add).toHaveBeenCalledWith(
          Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY,
          { name: 'ACME', userId: 'u1' }
        );
      });

      it('fails when the company of the admin does not exist', async () => {
        const { processor, companiesService, workQueue } = build();
        companiesService.findOne.mockResolvedValue(null);

        await expect(
          processor.processCreateOrUpdateSalesforceUser(
            job(Jobs.CREATE_OR_UPDATE_SALESFORCE_USER, {
              userId: 'u1',
              companyId: 'c1',
              isCompanyAdmin: true,
            })
          )
        ).rejects.toThrow('Company not found');
        expect(workQueue.add).not.toHaveBeenCalled();
      });

      it('chains the user company update when the user is a company member', async () => {
        const { processor, workQueue } = build();

        await processor.processCreateOrUpdateSalesforceUser(
          job(Jobs.CREATE_OR_UPDATE_SALESFORCE_USER, {
            userId: 'u1',
            companyId: 'c1',
            isCompanyAdmin: false,
          })
        );

        expect(workQueue.add).toHaveBeenCalledWith(
          Jobs.UPDATE_SALESFORCE_USER_COMPANY,
          { userId: 'u1', companyId: 'c1' }
        );
      });

      it('creates the company and chains the user company update when a userId is given', async () => {
        const { processor, salesforceService, companiesService, workQueue } =
          build();
        companiesService.findOneByName.mockResolvedValue({ id: 'c1' });

        const result = await processor.processCreateOrUpdateSalesforceCompany(
          job(Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY, {
            name: 'ACME',
            userId: 'u1',
            department: 'Paris (75)',
            phone: '0102030405',
          })
        );

        expect(
          salesforceService.createOrUpdateSalesforceCompany
        ).toHaveBeenCalledWith('ACME', {
          department: 'Paris (75)',
          phone: '0102030405',
        });
        expect(workQueue.add).toHaveBeenCalledWith(
          Jobs.UPDATE_SALESFORCE_USER_COMPANY,
          { userId: 'u1', companyId: 'c1' }
        );
        expect(result).toBe("Salesforce : created or updated company 'ACME'");
      });

      it('only creates the company when no userId is given', async () => {
        const { processor, workQueue } = build();

        await processor.processCreateOrUpdateSalesforceCompany(
          job(Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY, { name: 'ACME' })
        );

        expect(workQueue.add).not.toHaveBeenCalled();
      });

      it('fails when the company to link to the user cannot be found by name', async () => {
        const { processor, companiesService } = build();
        companiesService.findOneByName.mockResolvedValue(null);

        await expect(
          processor.processCreateOrUpdateSalesforceCompany(
            job(Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY, {
              name: 'ACME',
              userId: 'u1',
            })
          )
        ).rejects.toThrow('Company not found');
      });

      it('flags the user as company admin when they are the admin of the company', async () => {
        const { processor, companiesService, salesforceService } = build();
        companiesService.findOne.mockResolvedValue({
          name: 'ACME',
          admin: { id: 'u1' },
        });

        const result = await processor.processUpdateSalesforceUserCompany(
          job(Jobs.UPDATE_SALESFORCE_USER_COMPANY, {
            userId: 'u1',
            companyId: 'c1',
          })
        );

        expect(
          salesforceService.updateSalesforceUserCompany
        ).toHaveBeenCalledWith('u1', 'ACME', true, true);
        expect(result).toBe("Salesforce : updated user 'u1' company to 'c1'");
      });

      it('does not flag a regular member as admin even if the company has one', async () => {
        const { processor, companiesService, salesforceService } = build();
        companiesService.findOne.mockResolvedValue({
          name: 'ACME',
          admin: { id: 'someone-else' },
        });

        await processor.processUpdateSalesforceUserCompany(
          job(Jobs.UPDATE_SALESFORCE_USER_COMPANY, {
            userId: 'u1',
            companyId: 'c1',
          })
        );

        expect(
          salesforceService.updateSalesforceUserCompany
        ).toHaveBeenCalledWith('u1', 'ACME', false, true);
      });

      it('falls back to no company without failing when a coach removes their company', async () => {
        const { processor, companiesService, salesforceService } = build();

        await processor.processUpdateSalesforceUserCompany(
          job(Jobs.UPDATE_SALESFORCE_USER_COMPANY, {
            userId: 'u1',
            companyId: null,
          })
        );

        expect(companiesService.findOne).not.toHaveBeenCalled();
        expect(
          salesforceService.updateSalesforceUserCompany
        ).toHaveBeenCalledWith('u1', null, false, false);
      });

      it('fails when the declared company does not exist', async () => {
        const { processor, companiesService, salesforceService } = build();
        companiesService.findOne.mockResolvedValue(null);

        await expect(
          processor.processUpdateSalesforceUserCompany(
            job(Jobs.UPDATE_SALESFORCE_USER_COMPANY, {
              userId: 'u1',
              companyId: 'missing',
            })
          )
        ).rejects.toThrow('Company not found');
        expect(
          salesforceService.updateSalesforceUserCompany
        ).not.toHaveBeenCalled();
      });

      it('still succeeds when the Salesforce company account is not found', async () => {
        const { processor, companiesService, salesforceService } = build();
        companiesService.findOne.mockResolvedValue({
          name: 'ACME',
          admin: { id: 'admin' },
        });
        salesforceService.updateSalesforceUserCompany.mockResolvedValue({
          companyAccountNotFound: true,
        });

        await expect(
          processor.processUpdateSalesforceUserCompany(
            job(Jobs.UPDATE_SALESFORCE_USER_COMPANY, {
              userId: 'u1',
              companyId: 'c1',
            })
          )
        ).resolves.toContain("updated user 'u1'");
      });
    });
  });

  describe('processOnOnboardingCompleted', () => {
    const user = { id: 'u1', email: 'u1@example.org' };

    it('fails when the user does not exist', async () => {
      const { processor, usersService } = build();
      usersService.findOneWithRelations.mockResolvedValue(null);

      await expect(
        processor.processOnOnboardingCompleted(
          job(Jobs.ON_ONBOARDING_COMPLETED, { userId: 'u1' })
        )
      ).rejects.toThrow('User with id u1 not found');
    });

    it('fails when the user has no profile', async () => {
      const { processor, usersService, userProfilesService } = build();
      usersService.findOneWithRelations.mockResolvedValue(user);
      userProfilesService.findOneByUserId.mockResolvedValue(null);

      await expect(
        processor.processOnOnboardingCompleted(
          job(Jobs.ON_ONBOARDING_COMPLETED, { userId: 'u1' })
        )
      ).rejects.toThrow('UserProfile not found for user with id u1');
    });

    it('schedules the staff welcome message in one hour and mails the recommendations', async () => {
      const {
        processor,
        usersService,
        userProfilesService,
        userProfileRecommendationsService,
        workQueue,
      } = build();
      const recommendations = [{}, {}, {}];
      usersService.findOneWithRelations.mockResolvedValue(user);
      userProfilesService.findOneByUserId.mockResolvedValue({ id: 'p1' });
      usersService.generatePostOnboardingWelcomeMessage.mockResolvedValue(
        'Welcome!'
      );
      userProfileRecommendationsService.retrieveOrComputeRecommendationsForUserIdIA.mockResolvedValue(
        recommendations
      );

      const result = await processor.processOnOnboardingCompleted(
        job(Jobs.ON_ONBOARDING_COMPLETED, { userId: 'u1' })
      );

      expect(workQueue.add).toHaveBeenCalledWith(
        Jobs.SEND_STAFF_MESSAGING_MESSAGE,
        { addresseeEmail: 'u1@example.org', message: 'Welcome!' },
        { delay: 60 * 60 * 1000 }
      );
      expect(usersService.sendOnboardingCompletedMail).toHaveBeenCalledWith(
        user,
        recommendations
      );
      expect(result).toBe(
        'Processed onboarding completion for user with id u1'
      );
    });

    it('does not schedule any welcome message when none is generated', async () => {
      const {
        processor,
        usersService,
        userProfilesService,
        userProfileRecommendationsService,
        workQueue,
      } = build();
      usersService.findOneWithRelations.mockResolvedValue(user);
      userProfilesService.findOneByUserId.mockResolvedValue({ id: 'p1' });
      usersService.generatePostOnboardingWelcomeMessage.mockResolvedValue(null);
      userProfileRecommendationsService.retrieveOrComputeRecommendationsForUserIdIA.mockResolvedValue(
        [{}, {}, {}]
      );

      await processor.processOnOnboardingCompleted(
        job(Jobs.ON_ONBOARDING_COMPLETED, { userId: 'u1' })
      );

      expect(workQueue.add).not.toHaveBeenCalled();
    });

    it('warns the technical monitoring channel instead of mailing when there are fewer than 3 recommendations', async () => {
      const {
        processor,
        usersService,
        userProfilesService,
        userProfileRecommendationsService,
        slackService,
      } = build();
      usersService.findOneWithRelations.mockResolvedValue(user);
      userProfilesService.findOneByUserId.mockResolvedValue({ id: 'p1' });
      usersService.generatePostOnboardingWelcomeMessage.mockResolvedValue(null);
      userProfileRecommendationsService.retrieveOrComputeRecommendationsForUserIdIA.mockResolvedValue(
        [{}]
      );

      await processor.processOnOnboardingCompleted(
        job(Jobs.ON_ONBOARDING_COMPLETED, { userId: 'u1' })
      );

      expect(usersService.sendOnboardingCompletedMail).not.toHaveBeenCalled();
      expect(slackService.sendTechnicalMonitoringMessage).toHaveBeenCalledWith(
        false,
        expect.stringContaining('not enough recommendations'),
        [
          { title: 'User ID', content: 'u1' },
          { title: 'Recommendations', content: '1/3' },
        ],
        expect.stringContaining('u1')
      );
    });

    it('completes the job even if the recommendations cannot be computed', async () => {
      const {
        processor,
        usersService,
        userProfilesService,
        userProfileRecommendationsService,
      } = build();
      usersService.findOneWithRelations.mockResolvedValue(user);
      userProfilesService.findOneByUserId.mockResolvedValue({ id: 'p1' });
      usersService.generatePostOnboardingWelcomeMessage.mockResolvedValue(null);
      userProfileRecommendationsService.retrieveOrComputeRecommendationsForUserIdIA.mockRejectedValue(
        new Error('voyage down')
      );

      await expect(
        processor.processOnOnboardingCompleted(
          job(Jobs.ON_ONBOARDING_COMPLETED, { userId: 'u1' })
        )
      ).resolves.toBe('Processed onboarding completion for user with id u1');
      expect(usersService.sendOnboardingCompletedMail).not.toHaveBeenCalled();
    });
  });

  describe('staff messaging jobs', () => {
    const data = { addresseeEmail: 'user@example.org', message: 'Hi there' };

    it('sends the message from the staff contact of the addressee zone', async () => {
      const { processor, usersService, messagingService } = build();
      usersService.findOneByMailWithRelations.mockResolvedValue({
        id: 'addressee-1',
        zone: 'Paris',
        staffContact: { entourageProEmail: 'staff@entourage.social' },
      });
      usersService.findOneByMail.mockResolvedValue({ id: 'staff-1' });

      const result = await processor.processSendStaffMessagingMessage(
        job(Jobs.SEND_STAFF_MESSAGING_MESSAGE, data)
      );

      expect(usersService.findOneByMail).toHaveBeenCalledWith(
        'staff@entourage.social'
      );
      expect(
        messagingService.createMessageWithConversation
      ).toHaveBeenCalledWith(
        { content: 'Hi there', participantIds: ['addressee-1'] },
        'staff-1'
      );
      expect(result).toContain('staff@entourage.social');
    });

    it('fails when the addressee does not exist', async () => {
      const { processor, usersService, messagingService } = build();
      usersService.findOneByMailWithRelations.mockResolvedValue(null);

      await expect(
        processor.processSendStaffMessagingMessage(
          job(Jobs.SEND_STAFF_MESSAGING_MESSAGE, data)
        )
      ).rejects.toThrow('Addressee with email user@example.org not found');
      expect(
        messagingService.createMessageWithConversation
      ).not.toHaveBeenCalled();
    });

    it('fails when the addressee zone has no staff contact email', async () => {
      const { processor, usersService } = build();
      usersService.findOneByMailWithRelations.mockResolvedValue({
        id: 'addressee-1',
        zone: 'Paris',
        staffContact: { entourageProEmail: null },
      });

      await expect(
        processor.processSendStaffMessagingMessage(
          job(Jobs.SEND_STAFF_MESSAGING_MESSAGE, data)
        )
      ).rejects.toThrow('No staff contact email found');
    });

    it('fails when the staff contact has no account', async () => {
      const { processor, usersService, messagingService } = build();
      usersService.findOneByMailWithRelations.mockResolvedValue({
        id: 'addressee-1',
        zone: 'Paris',
        staffContact: { entourageProEmail: 'staff@entourage.social' },
      });
      usersService.findOneByMail.mockResolvedValue(null);

      await expect(
        processor.processSendStaffMessagingMessage(
          job(Jobs.SEND_STAFF_MESSAGING_MESSAGE, data)
        )
      ).rejects.toThrow('Staff contact with email staff@entourage.social');
      expect(
        messagingService.createMessageWithConversation
      ).not.toHaveBeenCalled();
    });

    it('splits a bulk message into one job per addressee', async () => {
      const { processor, workQueue } = build();
      const messages = [
        { addresseeEmail: 'a@example.org', message: 'm1' },
        { addresseeEmail: 'b@example.org', message: 'm2' },
      ];

      const result = await processor.processBulkSendStaffMessagingMessage(
        job(Jobs.BULK_SEND_STAFF_MESSAGING_MESSAGE, { messages })
      );

      expect(workQueue.add).toHaveBeenCalledTimes(2);
      expect(workQueue.add).toHaveBeenCalledWith(
        Jobs.SEND_STAFF_MESSAGING_MESSAGE,
        messages[1]
      );
      expect(result).toContain('a@example.org, b@example.org');
    });

    it('does nothing for a bulk message without addressee', async () => {
      const { processor, workQueue } = build();

      const result = await processor.processBulkSendStaffMessagingMessage(
        job(Jobs.BULK_SEND_STAFF_MESSAGING_MESSAGE, { messages: [] })
      );

      expect(workQueue.add).not.toHaveBeenCalled();
      expect(result).toBe(
        'No messages provided for bulk sending staff messaging message'
      );
    });
  });
});
