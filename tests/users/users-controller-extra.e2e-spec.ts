import { randomBytes } from 'crypto';
import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CompaniesService } from 'src/companies/companies.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';

// Generated at runtime (no hardcoded credential): "Aa1!" guarantees an upper
// case letter, a lower case letter, a digit and a special character.
const buildStrongPassword = () => `Aa1!${randomBytes(8).toString('hex')}`;
const STRONG_PASSWORD = buildStrongPassword();
const ANOTHER_STRONG_PASSWORD = buildStrongPassword();

describe('Users controller (members, company, password, update)', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let companiesService: CompaniesService;

  const queuesService = {
    addToWorkQueue: jest.fn(),
    addToEmbeddingQueue: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useValue(queuesService)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    companiesService = moduleFixture.get(CompaniesService);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    queuesService.addToWorkQueue.mockReset();
    queuesService.addToWorkQueue.mockResolvedValue({ id: '1' });
    queuesService.addToEmbeddingQueue.mockResolvedValue({ id: '1' });
  });

  const auth = (user: LoggedInUser) => ({
    authorization: `Bearer ${user.token}`,
  });

  describe('GET /user/members', () => {
    let admin: LoggedInUser;

    beforeEach(async () => {
      admin = await usersHelper.createLoggedInUser({ role: UserRoles.ADMIN });
    });

    it('lists the referers for an admin', async () => {
      const referer = await usersHelper.createLoggedInUser({
        role: UserRoles.REFERER,
      });
      await usersHelper.createLoggedInUser({ role: UserRoles.CANDIDATE });

      const response = await request(server)
        .get(`/user/members?limit=10&offset=0&role=${UserRoles.REFERER}`)
        .set(auth(admin));

      expect(response.status).toBe(200);
      expect(response.body.map((m: { id: string }) => m.id)).toEqual([
        referer.user.id,
      ]);
    });

    it('requires a role', async () => {
      const response = await request(server)
        .get('/user/members?limit=10&offset=0')
        .set(auth(admin));

      expect(response.status).toBe(400);
    });

    it('does not list the admins', async () => {
      const response = await request(server)
        .get(`/user/members?limit=10&offset=0&role=${UserRoles.ADMIN}`)
        .set(auth(admin));

      expect(response.status).toBe(400);
    });

    it.each([UserRoles.CANDIDATE, UserRoles.COACH, UserRoles.REFERER])(
      'refuses a %s',
      async (role) => {
        const user = await usersHelper.createLoggedInUser({ role });

        const response = await request(server)
          .get(`/user/members?limit=10&offset=0&role=${UserRoles.COACH}`)
          .set(auth(user));

        expect(response.status).toBe(403);
      }
    );

    it('refuses an anonymous user', async () => {
      const response = await request(server).get(
        `/user/members?limit=10&offset=0&role=${UserRoles.COACH}`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /user/company', () => {
    it('links a coach to the company he declares, creating it', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });

      const response = await request(server)
        .put('/user/company')
        .set(auth(coach))
        .send({ companyName: 'Declared Co' });

      expect(response.status).toBe(200);
      const company = await companiesService.findOneByName('Declared Co');
      expect(company).not.toBeNull();
      const withCompany = await usersHelper.findUser(coach.user.id);
      expect(withCompany.company.id).toBe(company.id);
    });

    it('unlinks a coach who declares no company', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      await request(server)
        .put('/user/company')
        .set(auth(coach))
        .send({ companyName: 'Declared Co' });

      const response = await request(server)
        .put('/user/company')
        .set(auth(coach))
        .send({ companyName: null });

      expect(response.status).toBe(200);
      const withCompany = await usersHelper.findUser(coach.user.id);
      expect(withCompany.company).toBeFalsy();
    });

    it.each([UserRoles.CANDIDATE, UserRoles.REFERER, UserRoles.ADMIN])(
      'refuses a %s',
      async (role) => {
        const user = await usersHelper.createLoggedInUser({ role });

        const response = await request(server)
          .put('/user/company')
          .set(auth(user))
          .send({ companyName: 'Declared Co' });

        expect(response.status).toBe(403);
      }
    );

    it('refuses an anonymous user', async () => {
      const response = await request(server)
        .put('/user/company')
        .send({ companyName: 'Declared Co' });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /user/changePwd', () => {
    let user: LoggedInUser;

    beforeEach(async () => {
      user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        password: STRONG_PASSWORD,
      });
    });

    it('changes the password when the old one is right and the new one strong enough', async () => {
      const response = await request(server)
        .put('/user/changePwd')
        .set(auth(user))
        .send({
          oldPassword: STRONG_PASSWORD,
          newPassword: ANOTHER_STRONG_PASSWORD,
        });

      expect(response.status).toBe(200);
      const again = await request(server)
        .put('/user/changePwd')
        .set(auth(user))
        .send({
          oldPassword: ANOTHER_STRONG_PASSWORD,
          newPassword: STRONG_PASSWORD,
        });
      expect(again.status).toBe(200);
    });

    it('refuses a wrong current password', async () => {
      const response = await request(server)
        .put('/user/changePwd')
        .set(auth(user))
        .send({ oldPassword: 'wrong', newPassword: ANOTHER_STRONG_PASSWORD });

      expect(response.status).toBe(401);
    });

    it('refuses a weak new password', async () => {
      const response = await request(server)
        .put('/user/changePwd')
        .set(auth(user))
        .send({ oldPassword: STRONG_PASSWORD, newPassword: 'abc' });

      expect(response.status).toBe(400);
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server)
        .put('/user/changePwd')
        .send({ oldPassword: 'a', newPassword: 'b' });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /user/:id', () => {
    it('answers 409 when the new email is already used', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const other = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });

      const response = await request(server)
        .put(`/user/${user.user.id}`)
        .set(auth(user))
        .send({ email: other.user.email });

      expect(response.status).toBe(409);
    });

    it('rejects an invalid phone number', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await request(server)
        .put(`/user/${user.user.id}`)
        .set(auth(user))
        .send({ phone: '123' });

      expect(response.status).toBe(400);
    });

    it('asks the user to verify a new email address', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await request(server)
        .put(`/user/${user.user.id}`)
        .set(auth(user))
        .send({ email: 'brand.new@example.org' });

      expect(response.status).toBe(200);
      const stored = await usersHelper.findUser(user.user.id);
      expect(stored.email).toBe('brand.new@example.org');
      expect(stored.isEmailVerified).toBe(false);
      expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toEmail: 'brand.new@example.org' })
      );
    });

    it("refuses to update somebody else's account", async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const other = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });

      const response = await request(server)
        .put(`/user/${other.user.id}`)
        .set(auth(user))
        .send({ firstName: 'Hacked' });

      expect(response.status).toBe(403);
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server)
        .put('/user/3f1c2a52-2b0c-4a0a-9a2e-0f3c9f7a1b11')
        .send({ firstName: 'x' });

      expect(response.status).toBe(401);
    });
  });
});
