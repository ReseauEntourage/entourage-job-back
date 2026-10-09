import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';
import {
  HelpGroupNotificationEmailKind,
  HelpGroupNotificationEmailKinds,
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
  } as User;

  const notification = (kind: HelpGroupNotificationEmailKind) => ({
    kind,
    actorFirstName: 'Amina',
    discussionTitle: 'Trou dans le CV',
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
          subject,
          templateId: MailjetTemplates.HELP_GROUP_NOTIFICATION,
          variables: expect.objectContaining({
            firstName: 'Julien',
            subject,
            kind,
            actorFirstName: 'Amina',
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

  it('Should send a weekly digest of two groups', async () => {
    const { mailsService, queuesService } = buildService();
    const groups = [
      {
        name: 'Refaire un CV',
        settingsUrl: 'https://front/cv',
        discussions: [
          { title: 'Trou dans le CV', authorFirstName: 'Thomas', url: 'u1' },
        ],
      },
      {
        name: 'Entretiens',
        settingsUrl: 'https://front/entretiens',
        discussions: [
          {
            title: 'Questions pièges',
            authorFirstName: 'Utilisateur supprimé',
            url: 'u2',
          },
        ],
      },
    ];
    await mailsService.sendHelpGroupsWeeklyDigest(addressee, {
      groups,
      groupsUrl: null,
    });
    expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(Jobs.SEND_MAIL, {
      toEmail: 'julien@example.com',
      subject: 'Cette semaine dans vos groupes',
      templateId: MailjetTemplates.HELP_GROUPS_WEEKLY_DIGEST,
      variables: expect.objectContaining({
        firstName: 'Julien',
        groups,
        groupsUrl: null,
        reason: expect.stringMatching(/^Vous recevez cet email parce que/),
      }),
    });
  });
});
