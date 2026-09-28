import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { Experience } from 'src/experiences/models';
import { Formation } from 'src/formations/models';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserProfileExperiencesService } from 'src/user-profile-experiences/user-profile-experiences.service';
import { UserProfileFormationsService } from 'src/user-profile-formations/user-profile-formations.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { MailsServiceMock } from 'tests/mails/mails.service.mock';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

describe('User profile experiences and formations order', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let formationModel: typeof Formation;
  let experienceModel: typeof Experience;
  let userProfileFormationsService: UserProfileFormationsService;
  let userProfileExperiencesService: UserProfileExperiencesService;

  let userProfileId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useValue(QueuesServiceMock)
      .overrideProvider(MailsService)
      .useClass(MailsServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    formationModel = moduleFixture.get<typeof Formation>(
      getModelToken(Formation)
    );
    experienceModel = moduleFixture.get<typeof Experience>(
      getModelToken(Experience)
    );
    userProfileFormationsService = moduleFixture.get(
      UserProfileFormationsService
    );
    userProfileExperiencesService = moduleFixture.get(
      UserProfileExperiencesService
    );
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    const user = await userFactory.create({ role: UserRoles.CANDIDATE });
    userProfileId = user.userProfile.id;
  });

  const createFormation = (
    title: string,
    startDate: string | null,
    endDate: string | null
  ) =>
    formationModel.create({
      title,
      userProfileId,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    });

  const createExperience = (
    title: string,
    startDate: string | null,
    endDate: string | null
  ) =>
    experienceModel.create({
      title,
      userProfileId,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    });

  it('lists an item with only an end date according to its end date', async () => {
    await createFormation('Bac', null, '2012-01-01');
    await createFormation('Master', '2018-09-01', '2020-06-01');

    const formations =
      await userProfileFormationsService.findByUserProfileId(userProfileId);

    expect(formations.map(({ title }) => title)).toEqual(['Master', 'Bac']);
  });

  it('lists items without any date after dated items', async () => {
    await createFormation('Sans date', null, null);
    await createFormation('Licence', '2010-09-01', null);
    await createExperience('Sans date', null, null);
    await createExperience('Stage', null, '2011-01-01');

    const formations =
      await userProfileFormationsService.findByUserProfileId(userProfileId);
    const experiences =
      await userProfileExperiencesService.findByUserProfileId(userProfileId);

    expect(formations.map(({ title }) => title)).toEqual([
      'Licence',
      'Sans date',
    ]);
    expect(experiences.map(({ title }) => title)).toEqual([
      'Stage',
      'Sans date',
    ]);
  });

  it('keeps start date descending order for items with a start date', async () => {
    await createExperience('Ancienne', '2012-01-01', '2015-01-01');
    await createExperience('Actuelle', '2020-01-01', null);
    await createExperience('Intermédiaire', '2016-01-01', '2019-12-01');

    const experiences =
      await userProfileExperiencesService.findByUserProfileId(userProfileId);

    expect(experiences.map(({ title }) => title)).toEqual([
      'Actuelle',
      'Intermédiaire',
      'Ancienne',
    ]);
  });
});
