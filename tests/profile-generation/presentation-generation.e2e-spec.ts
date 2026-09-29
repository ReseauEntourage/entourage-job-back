import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { BusinessSector } from 'src/business-sectors/models';
import { AnthropicService } from 'src/external-services/anthropic/anthropic.service';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Nudge } from 'src/nudge/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UserSocialSituationsService } from 'src/user-social-situations/user-social-situations.service';
import { Genders, UserRoles } from 'src/users/users.types';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { CompaniesHelper } from 'tests/companies/companies.helper';
import { CompanyFactory } from 'tests/companies/company.factory';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { S3Mocks } from 'tests/mocks.types';
import { NudgesHelper } from 'tests/nudges/nudges.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';

describe('ProfileGeneration - presentation', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let businessSectorsHelper: BusinessSectorHelper;
  let nudgesHelper: NudgesHelper;
  let companyFactory: CompanyFactory;
  let companiesHelper: CompaniesHelper;
  let userProfilesService: UserProfilesService;
  let userSocialSituationsService: UserSocialSituationsService;
  let throttlerStorage: ThrottlerStorageService;

  let businessSector: BusinessSector;
  let nudgeTips: Nudge;

  const generateText = jest.fn();
  const route = '/profile-generation/presentation';

  const lastCall = () => {
    const [systemPrompt, userMessage, options] =
      generateText.mock.calls[generateText.mock.calls.length - 1];
    return { systemPrompt, userMessage, options };
  };

  const post = (loggedInUser: LoggedInUser) =>
    request(server)
      .post(route)
      .set('authorization', `Bearer ${loggedInUser.token}`);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(S3Service)
      .useValue(S3Mocks)
      .overrideProvider(AnthropicService)
      .useValue({ generateText })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    businessSectorsHelper =
      moduleFixture.get<BusinessSectorHelper>(BusinessSectorHelper);
    nudgesHelper = moduleFixture.get<NudgesHelper>(NudgesHelper);
    companyFactory = moduleFixture.get<CompanyFactory>(CompanyFactory);
    companiesHelper = moduleFixture.get<CompaniesHelper>(CompaniesHelper);
    userProfilesService =
      moduleFixture.get<UserProfilesService>(UserProfilesService);
    userSocialSituationsService =
      moduleFixture.get<UserSocialSituationsService>(
        UserSocialSituationsService
      );
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    throttlerStorage.storage.clear();
    generateText.mockResolvedValue(
      "J'ai travaillé dans la logistique. N'hésitez pas à m'écrire."
    );
    await databaseHelper.resetTestDB();

    await businessSectorsHelper.deleteAllBusinessSectors();
    await businessSectorsHelper.seedBusinessSectors();
    businessSector = await businessSectorsHelper.findOne({ name: 'Sector 1' });

    await nudgesHelper.deleteAllNudges();
    await nudgesHelper.seedNudges();
    nudgeTips = await nudgesHelper.findOne({ value: 'tips' });
  });

  describe('POST /profile-generation/presentation', () => {
    it('returns a proposal built from the saved profile without writing it', async () => {
      const candidate = await usersHelper.createLoggedInUser(
        { role: UserRoles.CANDIDATE, gender: Genders.MALE },
        {
          userProfile: {
            description: null,
            sectorOccupations: [
              {
                businessSectorId: businessSector.id,
                occupation: { name: 'Développeur web' },
                order: 1,
              },
            ],
            experiences: [
              {
                title: 'Développeur full stack',
                company: 'Numéria',
                startDate: new Date('2021-01-01'),
                endDate: new Date('2023-01-01'),
                description: 'Applications web en TypeScript',
              },
            ],
            formations: [
              {
                title: 'Développeur web',
                institution: 'Wild Code School',
                startDate: new Date('2020-01-01'),
                endDate: new Date('2020-06-01'),
              },
            ],
            skills: [{ name: 'TypeScript' }, { name: 'Java Spring' }],
          },
        }
      );

      const response = await post(candidate);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        description:
          "J'ai travaillé dans la logistique. N'hésitez pas à m'écrire.",
      });

      const { systemPrompt, userMessage, options } = lastCall();
      expect(userMessage).toContain('Rôle : candidat');
      expect(userMessage).toContain('Développeur full stack');
      expect(userMessage).toContain('Numéria');
      expect(userMessage).toContain('2021 – 2023');
      expect(userMessage).toContain('Wild Code School');
      expect(userMessage).toContain('TypeScript, Java Spring');
      expect(userMessage).toContain('Métier : Développeur web');
      expect(userMessage).toContain('Secteur : Sector 1');
      expect(systemPrompt).toContain("démarche d'accompagnement");
      expect(systemPrompt).toContain('au masculin');
      expect(options).toEqual(
        expect.objectContaining({
          timeoutMs: 9000,
          feature: 'presentation_generation',
          operation: 'generate',
        })
      );

      const saved = await userProfilesService.findOneByUserId(
        candidate.user.id
      );
      expect(saved?.description).toBeNull();
    });

    it('still proposes a text when a presentation exists, and leaves it unchanged', async () => {
      const candidate = await usersHelper.createLoggedInUser(
        { role: UserRoles.CANDIDATE },
        { userProfile: { description: 'Ma présentation existante' } }
      );

      const response = await post(candidate);

      expect(response.status).toBe(200);
      expect(response.body.description).toBeTruthy();
      expect(generateText).toHaveBeenCalledTimes(1);
      const saved = await userProfilesService.findOneByUserId(
        candidate.user.id
      );
      expect(saved?.description).toBe('Ma présentation existante');
    });

    it('rejects unauthenticated requests', async () => {
      const response = await request(server).post(route);

      expect(response.status).toBe(401);
      expect(generateText).not.toHaveBeenCalled();
    });

    it('never sends the social situation, contact details, custom nudges, languages or interests', async () => {
      const coach = await usersHelper.createLoggedInUser(
        {
          role: UserRoles.COACH,
          firstName: 'Prénomsecret',
          lastName: 'Nomsecret',
          phone: '0612345678',
        },
        {
          userProfile: {
            currentJob: 'Responsable logistique',
            linkedinUrl: 'https://www.linkedin.com/in/secret-profile',
            sectorOccupations: [
              { businessSectorId: businessSector.id, order: 1 },
            ],
            customNudges: [{ content: 'Coup de pouce libre secret' }],
            interests: [{ name: 'Centre intérêt secret', order: 0 }],
          },
        }
      );
      // Saved separately: updating custom nudges in the same call would also
      // remove the reference nudges.
      await userProfilesService.updateByUserId(coach.user.id, {
        nudges: [{ id: nudgeTips.id }],
      });
      const company = await companyFactory.create({ name: 'Logistique SA' });
      await companiesHelper.linkCompanyToUser({
        userId: coach.user.id,
        companyId: company.id,
        role: 'employee',
      });

      await post(coach);

      const { userMessage } = lastCall();
      expect(userMessage).toContain('Métier actuel : Responsable logistique');
      expect(userMessage).toContain('Entreprise : Logistique SA');
      expect(userMessage).toContain(`- ${nudgeTips.nameOffer}`);
      expect(userMessage).toContain('Secteurs : Sector 1');
      for (const secret of [
        'Prénomsecret',
        'Nomsecret',
        '0612345678',
        coach.user.email,
        'linkedin',
        'Coup de pouce libre secret',
        'Centre intérêt secret',
      ]) {
        expect(userMessage).not.toContain(secret);
      }
    });

    it('does not send the social situation of a candidate', async () => {
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      await userSocialSituationsService.createOrUpdateSocialSituation(
        candidate.user.id,
        { materialInsecurity: true, networkInsecurity: true }
      );

      await post(candidate);

      const { userMessage } = lastCall();
      expect(userMessage).not.toMatch(/précarit|insecurity|situation/i);
    });

    it('writes without gender marks for the default gender', async () => {
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        gender: Genders.OTHER,
      });

      await post(candidate);

      expect(lastCall().systemPrompt).toContain(
        "N'utilise aucune marque de genre"
      );
    });

    it('writes in the feminine for a female user', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
        gender: Genders.FEMALE,
      });

      await post(coach);

      expect(lastCall().systemPrompt).toContain('au féminin');
    });

    it.each([UserRoles.REFERER, UserRoles.ADMIN])(
      'uses the coach instructions for a %s',
      async (role) => {
        const user = await usersHelper.createLoggedInUser({ role });

        const response = await post(user);

        expect(response.status).toBe(200);
        const { systemPrompt, userMessage } = lastCall();
        expect(systemPrompt).toContain('coach bénévole');
        expect(userMessage).toContain('Rôle : coach bénévole');
      }
    );

    it('cuts a text longer than 500 characters at the last full sentence', async () => {
      const sentence = 'Je travaille dans la logistique depuis longtemps. ';
      generateText.mockResolvedValue(sentence.repeat(11).trim());
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await post(candidate);

      expect(response.status).toBe(200);
      expect(response.body.description.length).toBeLessThanOrEqual(500);
      expect(response.body.description.endsWith('.')).toBe(true);
      expect(response.body.description).toBe(sentence.repeat(10).trim());
    });

    it('returns null when the model times out', async () => {
      generateText.mockRejectedValue(new APIConnectionTimeoutError());
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await post(candidate);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ description: null });
    });

    it.each(['', '   ', '« »'])(
      'returns null when the model output is empty after cleaning (%p)',
      async (output) => {
        generateText.mockResolvedValue(output);
        const candidate = await usersHelper.createLoggedInUser({
          role: UserRoles.CANDIDATE,
        });

        const response = await post(candidate);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ description: null });
      }
    );

    it('returns null when the model fails', async () => {
      generateText.mockRejectedValue(new Error('Anthropic unavailable'));
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await post(candidate);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ description: null });
    });

    it('rejects the sixth call within a minute without calling the model', async () => {
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      for (let i = 0; i < 5; i += 1) {
        const response = await post(candidate);
        expect(response.status).toBe(200);
      }
      const response = await post(candidate);

      expect(response.status).toBe(429);
      expect(generateText).toHaveBeenCalledTimes(5);
    });

    it('applies the limit per user, not per IP', async () => {
      const first = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const second = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      for (let i = 0; i < 5; i += 1) {
        await post(first);
      }
      const response = await post(second);

      expect(response.status).toBe(200);
    });
  });
});
