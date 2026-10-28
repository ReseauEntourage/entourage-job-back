import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';
import {
  HelpGroupNotificationEmailKind,
  HelpGroupNotificationEmailKinds,
  HelpGroupNotificationEmailReactionTargets,
} from 'src/help-groups/help-groups.types';
import { MailsService } from 'src/mails/mails.service';
import { Jobs } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';

describe('MailsService - help groups notifications', () => {
  const buildService = () => {
    const queuesService = {
      addToWorkQueue: jest.fn().mockResolvedValue(undefined),
    };
    const mailsService = new MailsService(queuesService as never);
    return { mailsService, queuesService };
  };

  const addressee = {
    id: 'user-id',
    email: 'julien@example.com',
    firstName: 'Julien',
    role: UserRoles.CANDIDATE,
    zone: ZoneName.IDF,
    staffContact: { name: 'Équipe', email: 'staff@example.com' },
  } as unknown as User;

  const notification = (kind: HelpGroupNotificationEmailKind) => ({
    kind,
    actorFirstName: 'Amina',
    discussionAuthorFirstName: 'Karim',
    discussionTitle: 'Trou dans le CV',
    reactionTarget:
      kind === HelpGroupNotificationEmailKinds.REACTION
        ? HelpGroupNotificationEmailReactionTargets.REPLY
        : null,
    groupName: 'Refaire un CV',
    excerpt: 'Parle de ton bénévolat.',
    discussionUrl: 'https://front/discussion',
    settingsUrl: 'https://front/settings',
  });

  it.each([
    [
      HelpGroupNotificationEmailKinds.REPLY_TO_AUTHOR,
      'Amina vous a répondu dans « Refaire un CV »',
    ],
    [
      HelpGroupNotificationEmailKinds.REPLY_TO_PARTICIPANT,
      'Amina a répondu dans une discussion où vous avez participé',
    ],
    [HelpGroupNotificationEmailKinds.REACTION, 'Amina a réagi à votre message'],
  ])(
    'Should send the %s email with its subject and variables',
    async (kind, subject) => {
      const { mailsService, queuesService } = buildService();
      await mailsService.sendHelpGroupNotification(
        addressee,
        notification(kind)
      );
      expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
        Jobs.SEND_MAIL,
        {
          toEmail: 'julien@example.com',
          userId: 'user-id',
          subject,
          templateId: MailjetTemplates.HELP_GROUP_NOTIFICATION,
          variables: expect.objectContaining({
            firstName: 'Julien',
            subject,
            kind,
            actorFirstName: 'Amina',
            discussionAuthorFirstName: 'Karim',
            reactionTarget:
              kind === HelpGroupNotificationEmailKinds.REACTION
                ? HelpGroupNotificationEmailReactionTargets.REPLY
                : '',
            staffContact: {
              name: 'Équipe',
              email: 'staff@example.com',
            },
            discussionTitle: 'Trou dans le CV',
            groupName: 'Refaire un CV',
            excerpt: 'Parle de ton bénévolat.',
            discussionUrl: 'https://front/discussion',
            settingsUrl: 'https://front/settings',
            reason: expect.stringMatching(/^Vous recevez cet email parce que/),
          }),
        }
      );
    }
  );

  it('Should send the daily email of two groups', async () => {
    const { mailsService, queuesService } = buildService();
    const groups = [
      {
        name: 'Refaire un CV',
        settingsUrl: 'https://front/cv',
        discussions: [
          {
            title: 'Trou dans le CV',
            authorFirstName: 'Thomas',
            excerpt: 'Je ne sais pas comment expliquer.',
            url: 'u1',
          },
        ],
      },
      {
        name: 'Entretiens',
        settingsUrl: 'https://front/entretiens',
        discussions: [
          {
            title: 'Questions pièges',
            authorFirstName: 'Amina',
            excerpt: '',
            url: 'u2',
          },
        ],
      },
    ];
    await mailsService.sendHelpGroupsDailyDigest(addressee, {
      subject: 'Nouvelles discussions dans vos groupes',
      groups,
      groupsUrl: null,
    });
    expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(Jobs.SEND_MAIL, {
      toEmail: 'julien@example.com',
      userId: 'user-id',
      subject: 'Nouvelles discussions dans vos groupes',
      templateId: MailjetTemplates.HELP_GROUPS_DAILY_DISCUSSIONS,
      variables: expect.objectContaining({
        firstName: 'Julien',
        groups,
        reason: expect.stringMatching(/^Vous recevez cet email parce que/),
      }),
    });
  });

  it('Should leave out of the daily email the variables Mailjet would reject as null', async () => {
    const { mailsService, queuesService } = buildService();
    await mailsService.sendHelpGroupsDailyDigest(addressee, {
      subject: 'Nouvelles discussions dans vos groupes',
      groups: [
        {
          name: 'Refaire un CV',
          settingsUrl: 'https://front/cv',
          discussions: [
            {
              title: null,
              authorFirstName: 'Thomas',
              excerpt: 'Bonjour',
              url: 'u1',
            },
          ],
        },
      ],
      groupsUrl: null,
    });
    const [, job] = queuesService.addToWorkQueue.mock.calls[0];
    const { variables } = job as { variables: Record<string, unknown> };
    expect(variables).not.toHaveProperty('groupsUrl');
    expect(JSON.stringify(variables)).not.toContain('null');
    expect(
      (variables.groups as { discussions: object[] }[])[0].discussions[0]
    ).not.toHaveProperty('title');
  });
});
