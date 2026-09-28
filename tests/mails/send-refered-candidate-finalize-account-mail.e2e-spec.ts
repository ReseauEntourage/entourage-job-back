import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';
import { MailsService } from 'src/mails/mails.service';
import { Jobs } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { ZoneName } from 'src/utils/types/zones.types';

describe('MailsService.sendReferedCandidateFinalizeAccountMail', () => {
  const buildService = () => {
    const queuesService = {
      addToWorkQueue: jest.fn().mockResolvedValue(undefined),
    };
    const mailsService = new MailsService(queuesService as never);
    return { mailsService, queuesService };
  };

  it('points the finalize account link at /finaliser-compte with the given token', async () => {
    const { mailsService, queuesService } = buildService();
    const candidate = {
      id: 'candidate-id',
      email: 'candidate@example.com',
      firstName: 'Jean',
      zone: ZoneName.IDF,
      staffContact: { email: 'staff@entourage.social', firstName: 'Staff' },
    } as unknown as User;
    const referer = {
      firstName: 'Marie',
      lastName: 'Martin',
      organization: { name: 'Association' },
    } as unknown as User;

    await mailsService.sendReferedCandidateFinalizeAccountMail(
      referer,
      candidate,
      'some-token'
    );

    expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
      Jobs.SEND_MAIL,
      expect.objectContaining({
        templateId: MailjetTemplates.REFERED_CANDIDATE_FINALIZE_ACCOUNT,
        variables: expect.objectContaining({
          finalizeAccountUrl: `${process.env.FRONT_URL}/finaliser-compte?token=some-token`,
        }),
      })
    );
  });
});
