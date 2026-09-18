import { MailsService } from 'src/mails/mails.service';
import { Jobs } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';

describe('MailsService — "National" zone label for HZ users', () => {
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
      role: UserRoles.CANDIDATE,
      staffContact: { email: 'staff@entourage.social', firstName: 'Staff' },
      ...props,
    }) as User;

  it('sends "National" as the zone variable for a user in the HZ zone', async () => {
    const { mailsService, queuesService } = buildService();
    const user = buildUser({ zone: ZoneName.HZ });

    await mailsService.sendPasswordResetLinkMail(user, 'token');

    expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
      Jobs.SEND_MAIL,
      expect.objectContaining({
        variables: expect.objectContaining({ zone: 'National' }),
      })
    );
  });

  it('sends "National" as the zone variable when the user has no zone (defaults to HZ)', async () => {
    const { mailsService, queuesService } = buildService();
    const user = buildUser({ zone: null });

    await mailsService.sendPasswordResetLinkMail(user, 'token');

    expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
      Jobs.SEND_MAIL,
      expect.objectContaining({
        variables: expect.objectContaining({ zone: 'National' }),
      })
    );
  });

  it('sends the actual zone unchanged for a user outside the HZ zone', async () => {
    const { mailsService, queuesService } = buildService();
    const user = buildUser({ zone: ZoneName.IDF });

    await mailsService.sendPasswordResetLinkMail(user, 'token');

    expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
      Jobs.SEND_MAIL,
      expect.objectContaining({
        variables: expect.objectContaining({ zone: ZoneName.IDF }),
      })
    );
  });
});
