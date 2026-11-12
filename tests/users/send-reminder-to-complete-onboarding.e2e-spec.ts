import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BusinessSector } from 'src/business-sectors/models';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UsersService } from 'src/users/users.service';
import { OnboardingStatus, UserRoles } from 'src/users/users.types';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

describe('UsersService.sendReminderToCompleteOnboarding', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersService: UsersService;
  let userProfilesService: UserProfilesService;
  let businessSectorsHelper: BusinessSectorHelper;
  let mailsService: { sendReminderToCompleteOnboarding: jest.Mock };

  let businessSector1: BusinessSector;
  let businessSector2: BusinessSector;

  const seedSectors = async () => {
    await businessSectorsHelper.deleteAllBusinessSectors();
    await businessSectorsHelper.seedBusinessSectors();
    businessSector1 = await businessSectorsHelper.findOne({
      name: 'Sector 1',
    });
    businessSector2 = await businessSectorsHelper.findOne({
      name: 'Sector 2',
    });
  };

  beforeAll(async () => {
    mailsService = {
      sendReminderToCompleteOnboarding: jest
        .fn()
        .mockResolvedValue({ withProfiles: true }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(MailsService)
      .useValue(mailsService)
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    usersService = moduleFixture.get<UsersService>(UsersService);
    userProfilesService =
      moduleFixture.get<UserProfilesService>(UserProfilesService);
    businessSectorsHelper =
      moduleFixture.get<BusinessSectorHelper>(BusinessSectorHelper);

    await databaseHelper.resetTestDB();
    await seedSectors();
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    mailsService.sendReminderToCompleteOnboarding.mockClear();
    await databaseHelper.resetTestDB();
    await seedSectors();
  });

  const createReminderRecipient = (businessSectorId: string) =>
    userFactory.create(
      {
        role: UserRoles.CANDIDATE,
        onboardingStatus: OnboardingStatus.IN_PROGRESS,
        elearningCompletedAt: null,
      },
      { userProfile: { sectorOccupations: [{ businessSectorId }] } }
    );

  const createCoaches = (
    count: number,
    businessSectorId: string,
    props: Record<string, unknown> = {},
    profileProps: Record<string, unknown> = {}
  ) =>
    databaseHelper.createEntities(
      userFactory,
      count,
      { role: UserRoles.COACH, ...props },
      {
        userProfile: {
          unavailableAt: null,
          sectorOccupations: [{ businessSectorId }],
          ...profileProps,
        },
      }
    );

  it('looks for the compatible profiles of the opposite role in the sectors saved on the profile, among visible profiles only', async () => {
    const user = await createReminderRecipient(businessSector1.id);
    const visible = await createCoaches(4, businessSector1.id);
    await createCoaches(2, businessSector2.id); // other sector
    await createCoaches(
      1,
      businessSector1.id,
      {},
      { unavailableAt: new Date() }
    );
    await createCoaches(1, businessSector1.id, {
      onboardingStatus: OnboardingStatus.IN_PROGRESS,
    });
    await createCoaches(1, businessSector1.id, { elearningCompletedAt: null });

    const result = await usersService.sendReminderToCompleteOnboarding(user);

    expect(result).toEqual({ withProfiles: true });
    expect(mailsService.sendReminderToCompleteOnboarding).toHaveBeenCalledTimes(
      1
    );
    const [recipient, compatibleProfiles] =
      mailsService.sendReminderToCompleteOnboarding.mock.calls[0];
    expect(recipient.id).toBe(user.id);
    expect(compatibleProfiles.count).toBe(4);
    expect(
      compatibleProfiles.profiles.every(({ id }: { id: string }) =>
        visible.some((coach) => coach.id === id)
      )
    ).toBe(true);
  });

  it('only considers visible profiles and skips the response delay, which the mail does not use', async () => {
    const user = await createReminderRecipient(businessSector1.id);
    const spy = jest.spyOn(
      userProfilesService,
      'findPreRegistrationCompatibleProfiles'
    );

    await usersService.sendReminderToCompleteOnboarding(user);

    expect(spy).toHaveBeenCalledWith(
      UserRoles.CANDIDATE,
      expect.any(Array),
      [businessSector1.id],
      { onlyVisibleProfiles: true, withAverageDelayResponse: false }
    );
  });

  it('passes fewer than 3 profiles on to the mail, which sends the version without profiles', async () => {
    const user = await createReminderRecipient(businessSector1.id);
    await createCoaches(2, businessSector1.id);
    mailsService.sendReminderToCompleteOnboarding.mockResolvedValueOnce({
      withProfiles: false,
    });

    const result = await usersService.sendReminderToCompleteOnboarding(user);

    expect(result).toEqual({ withProfiles: false });
    const [, compatibleProfiles] =
      mailsService.sendReminderToCompleteOnboarding.mock.calls[0];
    expect(compatibleProfiles.count).toBe(2);
    expect(compatibleProfiles.profiles).toHaveLength(2);
  });

  it('sends the reminder with no profile at all when none is compatible', async () => {
    const user = await createReminderRecipient(businessSector1.id);

    await usersService.sendReminderToCompleteOnboarding(user);

    expect(mailsService.sendReminderToCompleteOnboarding).toHaveBeenCalledWith(
      user,
      { count: 0, profiles: [] }
    );
  });

  it('still sends the reminder, without profiles, when the search for compatible profiles fails', async () => {
    const user = await createReminderRecipient(businessSector1.id);
    jest
      .spyOn(userProfilesService, 'findPreRegistrationCompatibleProfiles')
      .mockRejectedValueOnce(new Error('search failed'));

    await expect(
      usersService.sendReminderToCompleteOnboarding(user)
    ).resolves.toBeDefined();

    expect(mailsService.sendReminderToCompleteOnboarding).toHaveBeenCalledWith(
      user,
      { count: 0, profiles: [] }
    );
  });
});
