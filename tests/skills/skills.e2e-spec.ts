import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { LoggedInUser, UsersHelper } from '../users/users.helper';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Skill } from 'src/skills/models';
import { SkillsService } from 'src/skills/skills.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';

describe('Skills', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let skillsService: SkillsService;
  let skillModel: typeof Skill;
  let usersHelper: UsersHelper;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    skillsService = app.get(SkillsService);
    skillModel = app.get(getModelToken(Skill));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await skillsService.bulkCreateSkills([
      { name: 'Électricité' },
      { name: 'Cuisine' },
      { name: 'Comptabilité' },
      { name: 'Anglais' },
    ]);
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('GET /skills (public)', () => {
    it('lists the skills by name to an anonymous user', async () => {
      const response = await request(server)
        .get('/skills')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.map(({ name }: Skill) => name)).toEqual([
        'Anglais',
        'Comptabilité',
        'Cuisine',
        'Électricité',
      ]);
    });

    it.each([
      UserRoles.CANDIDATE,
      UserRoles.COACH,
      UserRoles.REFERER,
      UserRoles.ADMIN,
    ])('lists the skills to a logged in %s', async (role) => {
      const loggedIn: LoggedInUser = await usersHelper.createLoggedInUser({
        role,
      });

      const response = await request(server)
        .get('/skills')
        .query({ limit: 10, offset: 0 })
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4);
    });

    it('paginates with limit and offset', async () => {
      const response = await request(server)
        .get('/skills')
        .query({ limit: 2, offset: 1 });

      expect(response.status).toBe(200);
      expect(response.body.map(({ name }: Skill) => name)).toEqual([
        'Comptabilité',
        'Cuisine',
      ]);
    });

    it('searches ignoring case and accents', async () => {
      const response = await request(server)
        .get('/skills')
        .query({ limit: 10, offset: 0, search: 'ELECTRI' });

      expect(response.status).toBe(200);
      expect(response.body.map(({ name }: Skill) => name)).toEqual([
        'Électricité',
      ]);
    });

    it('returns 400 without numeric limit and offset', async () => {
      expect((await request(server).get('/skills')).status).toBe(400);
      expect(
        (await request(server).get('/skills').query({ limit: 'a', offset: 0 }))
          .status
      ).toBe(400);
    });
  });

  describe('SkillsService', () => {
    it('findOneByName is case-insensitive and null when unknown', async () => {
      expect((await skillsService.findOneByName('cuisine')).name).toBe(
        'Cuisine'
      );
      expect(await skillsService.findOneByName('Plomberie')).toBeNull();
    });

    it('findAll without pagination returns every skill', async () => {
      expect(await skillsService.findAll()).toHaveLength(
        await skillModel.count()
      );
    });
  });
});
