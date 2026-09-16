import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';
import { MailsService } from 'src/mails/mails.service';
import { Jobs } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { ZoneName } from 'src/utils/types/zones.types';

describe('MailsService.sendVerificationMail', () => {
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

  it('sends "no_otp" as otpCode when no OTP is given (e.g. email change re-verification)', async () => {
    const { mailsService, queuesService } = buildService();
    const user = buildUser({});

    await mailsService.sendVerificationMail(user, 'some-token');

    expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
      Jobs.SEND_MAIL,
      expect.objectContaining({
        templateId: MailjetTemplates.USER_EMAIL_VERIFICATION,
        variables: expect.objectContaining({
          otpCode: 'no_otp',
        }),
      })
    );
  });

  it('sends the given OTP code as otpCode when one is provided', async () => {
    const { mailsService, queuesService } = buildService();
    const user = buildUser({});

    await mailsService.sendVerificationMail(user, 'some-token', '123456');

    expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
      Jobs.SEND_MAIL,
      expect.objectContaining({
        variables: expect.objectContaining({
          otpCode: '123456',
        }),
      })
    );
  });
});
