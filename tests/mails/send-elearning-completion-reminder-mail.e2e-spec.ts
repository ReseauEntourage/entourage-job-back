import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';
import { MailsService } from 'src/mails/mails.service';
import { Jobs } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';

describe('MailsService.sendElearningCompletionReminderMail', () => {
  const buildService = () => {
    const queuesService = {
      addToWorkQueue: jest.fn().mockResolvedValue(undefined),
    };
    const mailsService = new MailsService(queuesService as never);
    return { mailsService, queuesService };
  };

  const buildUser = (props: Partial<User>): User =>
    ({
      id: 'user-id',
      email: 'user@example.com',
      firstName: 'Jean',
      zone: ZoneName.IDF,
      staffContact: { email: 'staff@entourage.social', firstName: 'Staff' },
      ...props,
    }) as User;

  it('sends the reminder using the ELEARNING_COMPLETION_REMINDER template', async () => {
    const { mailsService, queuesService } = buildService();
    const user = buildUser({ role: UserRoles.CANDIDATE });

    await mailsService.sendElearningCompletionReminderMail(
      user,
      UserRoles.COACH
    );

    expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
      Jobs.SEND_MAIL,
      expect.objectContaining({
        toEmail: user.email,
        templateId: MailjetTemplates.ELEARNING_COMPLETION_REMINDER,
      })
    );
  });

  it('builds oppositeRole from the given mirror role, lowercased ("coach" for the CANDIDATE mirror)', async () => {
    const { mailsService, queuesService } = buildService();
    const user = buildUser({ role: UserRoles.CANDIDATE });

    await mailsService.sendElearningCompletionReminderMail(
      user,
      UserRoles.COACH
    );

    expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
      Jobs.SEND_MAIL,
      expect.objectContaining({
        variables: expect.objectContaining({
          firstName: user.firstName,
          staffContact: user.staffContact,
          role: 'Candidat',
          oppositeRole: 'coach',
        }),
      })
    );
  });

  it('builds oppositeRole from the given mirror role, lowercased ("candidat" for the COACH mirror)', async () => {
    const { mailsService, queuesService } = buildService();
    const user = buildUser({ role: UserRoles.COACH });

    await mailsService.sendElearningCompletionReminderMail(
      user,
      UserRoles.CANDIDATE
    );

    expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
      Jobs.SEND_MAIL,
      expect.objectContaining({
        variables: expect.objectContaining({
          role: 'Coach',
          oppositeRole: 'candidat',
        }),
      })
    );
  });
});
