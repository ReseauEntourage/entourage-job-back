import {
  SlackService,
  escapeSlackText,
  resolveReferentSlackUserIds,
} from 'src/external-services/slack/slack.service';
import { slackChannels } from 'src/external-services/slack/slack.types';
import { ReportTargetTypes } from 'src/reports/reports.types';

// Pure unit tests (no database, no network): the Slack web client is replaced by mocks.
describe('SlackService', () => {
  const envBackup = { ...process.env };

  const buildService = () => {
    const service = new SlackService();
    const client = {
      chat: { postMessage: jest.fn(), update: jest.fn() },
      users: { lookupByEmail: jest.fn() },
    };
    (service as unknown as { app: { client: typeof client } }).app = { client };
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
    return { service, client };
  };

  const user = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'user-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      role: 'Candidat',
      staffContact: { slackEmail: 'staff@example.com' },
      ...overrides,
    }) as never;

  beforeEach(() => {
    process.env.HEROKU_APP_NAME = 'test-env';
    process.env.SLACK_BOT_TOKEN = 'token';
  });

  afterEach(() => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
  });

  describe('helpers', () => {
    it('escapeSlackText neutralises the control characters', () => {
      expect(escapeSlackText('<!channel> & <@U1>')).toBe(
        '&lt;!channel&gt; &amp; &lt;@U1&gt;'
      );
    });

    it('resolveReferentSlackUserIds de-duplicates emails and ignores unknown referents', async () => {
      const lookup = jest
        .fn()
        .mockImplementation(async (email: string) =>
          email === 'a@example.com' ? 'U1' : null
        );

      const ids = await resolveReferentSlackUserIds(
        [
          { staffContact: { slackEmail: 'a@example.com' } },
          { staffContact: { slackEmail: 'a@example.com' } },
          { staffContact: { slackEmail: 'b@example.com' } },
          { staffContact: {} },
          null,
          undefined,
        ] as never,
        lookup
      );

      expect(ids).toEqual(['U1']);
      expect(lookup).toHaveBeenCalledTimes(2);
    });
  });

  describe('sending', () => {
    it('sendMessage posts to the given channel with the bot token', async () => {
      const { service, client } = buildService();
      client.chat.postMessage.mockResolvedValue({ ok: true, ts: '1' });

      const response = await service.sendMessage('chan', [], 'hello');

      expect(response).toEqual({ ok: true, ts: '1' });
      expect(client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'chan',
        text: 'hello',
        token: 'token',
        blocks: [],
      });
    });

    it('postModerationAlert returns the message reference, or null when Slack gives no location', async () => {
      const { service, client } = buildService();
      client.chat.postMessage
        .mockResolvedValueOnce({ ok: true, channel: 'C1', ts: '12.3' })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true, channel: 'C1' })
        .mockResolvedValueOnce(undefined);

      expect(await service.postModerationAlert([], 'm')).toEqual({
        channel: 'C1',
        ts: '12.3',
        blocks: [],
      });
      expect(await service.postModerationAlert([], 'm')).toBeNull();
      expect(await service.postModerationAlert([], 'm')).toBeNull();
      expect(await service.postModerationAlert([], 'm')).toBeNull();
      expect(client.chat.postMessage.mock.calls[0][0].channel).toBe(
        slackChannels.ENTOURAGE_PRO_MODERATION
      );
    });

    it('sendReplyMessage threads the reply and swallows Slack errors', async () => {
      const { service, client } = buildService();
      client.chat.postMessage.mockResolvedValueOnce({ ok: true });
      await service.sendReplyMessage('chan', '12.3', [], 'details');
      expect(client.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ thread_ts: '12.3', channel: 'chan' })
      );

      client.chat.postMessage.mockRejectedValueOnce(new Error('slack down'));
      await expect(
        service.sendReplyMessage('chan', '12.3', [], 'details')
      ).resolves.toBeUndefined();
    });

    it('markModerationAlertHandled keeps only the target button and prepends the status', async () => {
      const { service, client } = buildService();
      client.chat.update.mockResolvedValue({ ok: true });

      await service.markModerationAlertHandled(
        {
          channel: 'C1',
          ts: '12.3',
          blocks: [
            { type: 'divider' },
            {
              type: 'actions',
              elements: [
                { action_id: 'moderation-resolve-0' },
                { action_id: 'report-target-1' },
              ],
            },
            {
              type: 'actions',
              elements: [{ action_id: 'moderation-delete-0' }],
            },
          ],
        } as never,
        'Traité'
      );

      const call = client.chat.update.mock.calls[0][0];
      expect(call).toMatchObject({ channel: 'C1', ts: '12.3', text: 'Traité' });
      expect(call.blocks).toEqual([
        { type: 'divider' },
        { type: 'context', elements: [{ type: 'mrkdwn', text: 'Traité' }] },
        {
          type: 'actions',
          elements: [{ action_id: 'report-target-1' }],
        },
        { type: 'context', elements: [{ type: 'mrkdwn', text: 'Traité' }] },
      ]);
    });
  });

  describe('getUserIdByEmail', () => {
    it('returns the Slack id of a found user', async () => {
      const { service, client } = buildService();
      client.users.lookupByEmail.mockResolvedValue({
        ok: true,
        user: { id: 'U42' },
      });

      expect(await service.getUserIdByEmail('a@example.com')).toBe('U42');
    });

    it('returns null when the user is not found or Slack fails', async () => {
      const { service, client } = buildService();
      client.users.lookupByEmail.mockResolvedValueOnce({ ok: false });
      client.users.lookupByEmail.mockRejectedValueOnce(new Error('boom'));

      expect(await service.getUserIdByEmail('a@example.com')).toBeNull();
      expect(await service.getUserIdByEmail('a@example.com')).toBeNull();
    });
  });

  describe('moderation alerts', () => {
    const setup = () => {
      const ctx = buildService();
      ctx.client.users.lookupByEmail.mockResolvedValue({
        ok: true,
        user: { id: 'UREF' },
      });
      ctx.client.chat.postMessage.mockResolvedValue({
        ok: true,
        channel: 'C1',
        ts: '1.1',
      });
      return ctx;
    };

    const allText = (blocks: unknown) => JSON.stringify(blocks);

    it('sendMessageUserReported mentions the referent and links the report', async () => {
      const { service, client } = setup();

      const sent = await service.sendMessageUserReported(
        user({ id: 'reporter', email: 'reporter@example.com' }),
        user(),
        'Spam',
        'a <comment>'
      );

      expect(sent).toMatchObject({ channel: 'C1', ts: '1.1' });
      const { blocks, text } = client.chat.postMessage.mock.calls[0][0];
      expect(text).toBe('Le profil de Jane Doe a été signalé');
      expect(allText(blocks)).toContain('<@UREF>');
      expect(allText(blocks)).toContain('a &lt;comment&gt;');
      expect(allText(blocks)).toContain('Marquer comme traité');
    });

    it('sendMessageUserReported says when there is no referent or no comment', async () => {
      const { service, client } = setup();
      client.users.lookupByEmail.mockResolvedValue({ ok: false });

      await service.sendMessageUserReported(
        user(),
        user({ staffContact: undefined }),
        'Spam',
        null
      );

      const { blocks } = client.chat.postMessage.mock.calls[0][0];
      expect(allText(blocks)).toContain('Aucun référent assigné');
      expect(allText(blocks)).toContain('Aucun commentaire');
    });

    it('sendHelpGroupMessageReported lists the referents of author and reporter', async () => {
      const { service, client } = setup();

      await service.sendHelpGroupMessageReported({
        author: user(),
        reporter: user({
          id: 'reporter',
          staffContact: { slackEmail: 'other@example.com' },
        }),
        comment: null,
        excerpt: 'a & b',
        groupName: 'Groupe <A>',
        isReply: true,
        messageUrl: 'https://front.invalid/group?x=1',
        reasonLabel: 'Spam',
        target: {
          targetType: ReportTargetTypes.USER_PROFILE,
          targetId: 'target-1',
        } as never,
      });

      const { blocks, text } = client.chat.postMessage.mock.calls[0][0];
      expect(text).toBe('Un message du groupe Groupe &lt;A&gt; a été signalé');
      expect(allText(blocks)).toContain('<@UREF>');
      expect(allText(blocks)).toContain('Réponse');
      expect(allText(blocks)).toContain('Aucun commentaire');
      expect(allText(blocks)).toContain('a &amp; b');
    });

    it('sendHelpGroupMessageReported without any referent says so', async () => {
      const { service, client } = setup();
      client.users.lookupByEmail.mockResolvedValue({ ok: false });

      await service.sendHelpGroupMessageReported({
        author: user({ staffContact: undefined }),
        reporter: null,
        comment: 'bad',
        excerpt: 'x',
        groupName: 'G',
        isReply: false,
        messageUrl: 'https://front.invalid/group',
        reasonLabel: 'Spam',
        target: {
          targetType: ReportTargetTypes.USER_PROFILE,
          targetId: 'target-1',
        } as never,
      });

      const { blocks } = client.chat.postMessage.mock.calls[0][0];
      expect(allText(blocks)).toContain('Aucun référent identifié');
      expect(allText(blocks)).toContain('Compte supprimé');
      expect(allText(blocks)).toContain('Discussion');
    });

    it('sendHelpGroupMessageAutoHidden raises a priority alert', async () => {
      const { service, client } = setup();

      await service.sendHelpGroupMessageAutoHidden({
        author: user(),
        groupName: 'G',
        isReply: false,
        messageUrl: 'https://front.invalid/group',
        reasonLabels: ['Spam', 'Haine'],
      });

      const { blocks, text } = client.chat.postMessage.mock.calls[0][0];
      expect(text).toContain('PRIORITAIRE');
      expect(allText(blocks)).toContain('Spam, Haine');
      expect(allText(blocks)).toContain('<@UREF>');
    });

    it('sendHelpGroupMessageAutoHidden without referent says so', async () => {
      const { service, client } = setup();
      client.users.lookupByEmail.mockResolvedValue({ ok: false });

      await service.sendHelpGroupMessageAutoHidden({
        author: user(),
        groupName: 'G',
        isReply: true,
        messageUrl: 'https://front.invalid/group',
        reasonLabels: ['Spam'],
      });

      expect(
        allText(client.chat.postMessage.mock.calls[0][0].blocks)
      ).toContain('Aucun référent identifié');
    });
  });

  describe('admin notifications', () => {
    const setup = (referentFound = true) => {
      const ctx = buildService();
      ctx.client.users.lookupByEmail.mockResolvedValue(
        referentFound ? { ok: true, user: { id: 'UREF' } } : { ok: false }
      );
      ctx.client.chat.postMessage.mockResolvedValue({ ok: true });
      return ctx;
    };

    it('sendAdminNewRefererNotification mentions the referent and the organization', async () => {
      const { service, client } = setup();

      await service.sendAdminNewRefererNotification(
        user({ organization: { name: 'Asso' } })
      );

      const { blocks, text } = client.chat.postMessage.mock.calls[0][0];
      expect(text).toBe('Nouveau prescripteur inscrit : Jane Doe');
      expect(JSON.stringify(blocks)).toContain('<@UREF>');
      expect(JSON.stringify(blocks)).toContain('Asso');
    });

    it('sendAdminNewRefererNotification works without referent nor organization', async () => {
      const { service, client } = setup();

      await service.sendAdminNewRefererNotification(
        user({ staffContact: undefined })
      );

      const { blocks } = client.chat.postMessage.mock.calls[0][0];
      expect(JSON.stringify(blocks)).toContain('Aucun référent assigné');
      expect(JSON.stringify(blocks)).toContain('Aucune');
      expect(client.users.lookupByEmail).not.toHaveBeenCalled();
    });

    it('sendAdminNewReferingNotification names the referer of the candidate', async () => {
      const { service, client } = setup();

      await service.sendAdminNewReferingNotification(
        user(),
        user({ firstName: 'Ref', lastName: 'Erer' })
      );

      const { blocks, text } = client.chat.postMessage.mock.calls[0][0];
      expect(text).toBe('Un nouveau candidat a été orienté : Jane Doe');
      expect(JSON.stringify(blocks)).toContain('Ref Erer');
    });

    it('sendAdminNewReferingNotification works without referent', async () => {
      const { service, client } = setup();

      await service.sendAdminNewReferingNotification(
        user({ staffContact: undefined }),
        user()
      );

      expect(
        JSON.stringify(client.chat.postMessage.mock.calls[0][0].blocks)
      ).toContain('Aucun référent assigné');
    });
  });

  describe('technical monitoring', () => {
    it('sends a success or a warning title with the environment, and no reply without details', async () => {
      const { service, client } = buildService();
      client.chat.postMessage.mockResolvedValue({ ok: true, ts: '5.5' });

      await service.sendTechnicalMonitoringMessage(true, 'Job done', [
        { title: 'Count', content: '3' },
        { imageUrl: 'https://img.invalid/x.png', altText: 'logo' },
      ]);
      await service.sendTechnicalMonitoringMessage(false, 'Job failed', []);

      expect(client.chat.postMessage).toHaveBeenCalledTimes(2);
      const first = JSON.stringify(
        client.chat.postMessage.mock.calls[0][0].blocks
      );
      expect(first).toContain('Job done - env: test-env');
      expect(first).toContain('railway_car');
      expect(first).toContain('"type":"image"');
      expect(
        JSON.stringify(client.chat.postMessage.mock.calls[1][0].blocks)
      ).toContain(':warning:');
      expect(client.chat.postMessage.mock.calls[0][0].channel).toBe(
        slackChannels.TECH_PRO_MONITORING
      );
    });

    it('replies in a thread with the details when given', async () => {
      const { service, client } = buildService();
      client.chat.postMessage.mockResolvedValue({ ok: true, ts: '5.5' });

      await service.sendTechnicalMonitoringMessage(
        true,
        'Job done',
        [],
        'stack trace',
        'custom-channel'
      );

      expect(client.chat.postMessage).toHaveBeenCalledTimes(2);
      expect(client.chat.postMessage.mock.calls[1][0]).toMatchObject({
        channel: 'custom-channel',
        thread_ts: '5.5',
        text: 'stack trace',
      });
    });

    it('generateTechNotificationBlocks adds the optional message', async () => {
      const { service } = buildService();

      const blocks = await service.generateTechNotificationBlocks(
        true,
        'T',
        [],
        'extra'
      );

      expect(JSON.stringify(blocks)).toContain('extra');
    });
  });

  describe('checkin contact request alert', () => {
    const checkin = (overrides: Record<string, unknown> = {}) =>
      ({
        rating: 2,
        stillInTouch: undefined,
        exchangeModes: [],
        exchangeFrequency: undefined,
        perceivedBenefits: [],
        perceivedSupport: undefined,
        employmentType: undefined,
        comment: undefined,
        ...overrides,
      }) as never;

    it('alerts the referent and attaches the details as a thread reply', async () => {
      const { service, client } = buildService();
      client.users.lookupByEmail.mockResolvedValue({
        ok: true,
        user: { id: 'UREF' },
      });
      client.chat.postMessage.mockResolvedValue({ ok: true, ts: '9.9' });

      await service.sendCheckinContactRequestAlert(
        user(),
        checkin({ comment: 'Besoin d’aide' }),
        user({ firstName: 'Other', lastName: 'Person' })
      );

      expect(client.chat.postMessage).toHaveBeenCalledTimes(2);
      const alert = client.chat.postMessage.mock.calls[0][0];
      expect(alert.text).toContain('Jane Doe souhaite être recontacté·e');
      expect(JSON.stringify(alert.blocks)).toContain('<@UREF>');
      const reply = client.chat.postMessage.mock.calls[1][0];
      expect(reply.thread_ts).toBe('9.9');
      expect(reply.text).toContain('*Note de la relation :* 2/5');
      expect(reply.text).toContain('*Commentaire libre :* Besoin d’aide');
    });

    it('copes with an unknown interlocutor, no referent and no ts', async () => {
      const { service, client } = buildService();
      client.chat.postMessage.mockResolvedValue({ ok: true });

      await service.sendCheckinContactRequestAlert(
        user({ staffContact: undefined }),
        checkin(),
        null
      );

      expect(client.chat.postMessage).toHaveBeenCalledTimes(1);
      const alert = client.chat.postMessage.mock.calls[0][0];
      expect(alert.text).toContain('un interlocuteur inconnu');
      expect(JSON.stringify(alert.blocks)).toContain('Aucun référent assigné');
    });

    it('formats every answered field of the checkin in the reply', async () => {
      const { service, client } = buildService();
      client.chat.postMessage.mockResolvedValue({ ok: true, ts: '1.1' });
      const labels = jest.requireActual('src/checkin/checkin.types');

      await service.sendCheckinContactRequestAlert(
        user(),
        checkin({
          stillInTouch: Object.keys(labels.CHECKIN_STILL_IN_TOUCH_LABELS)[0],
          exchangeModes: [Object.keys(labels.CHECKIN_EXCHANGE_MODE_LABELS)[0]],
          exchangeFrequency: Object.keys(
            labels.CHECKIN_EXCHANGE_FREQUENCY_LABELS
          )[0],
          perceivedBenefits: [
            Object.keys(labels.CHECKIN_PERCEIVED_BENEFIT_LABELS)[0],
            'unknown-benefit',
          ],
          perceivedSupport: Object.keys(
            labels.CHECKIN_PERCEIVED_SUPPORT_LABELS
          )[0],
          employmentType: Object.keys(labels.CHECKIN_EMPLOYMENT_TYPE_LABELS)[0],
        }),
        user()
      );

      const reply = client.chat.postMessage.mock.calls[1][0].text as string;
      expect(reply).not.toContain('*Encore en lien ?* —');
      expect(reply).toContain('unknown-benefit');
      expect(reply).toContain("*De quoi il s'agit :*");
    });
  });

  describe('warnOnMissingChannelConfig', () => {
    it('warns in production when a channel variable is missing, and stays silent otherwise', () => {
      const { service } = buildService();
      const warn = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation(() => undefined);

      process.env.NODE_ENV = 'test';
      service.onModuleInit();
      expect(warn).not.toHaveBeenCalled();

      process.env.NODE_ENV = 'production';
      delete process.env.SLACK_CHANNEL_MODERATION;
      service.onModuleInit();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('SLACK_CHANNEL_MODERATION')
      );
    });
  });
});
