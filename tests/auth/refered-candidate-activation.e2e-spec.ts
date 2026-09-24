import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { MailsServiceMock } from 'tests/mails/mails.service.mock';
import { OrganizationFactory } from 'tests/organizations/organization.factory';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

describe('Refered candidate account activation', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let organizationFactory: OrganizationFactory;
  let usersService: UsersService;
  let jwtService: JwtService;
  let mailsService: MailsServiceMock;
  let throttlerStorage: ThrottlerStorageService;

  const route = '/auth';
  const newPassword = 'Candidat123!';

  // A negative `expiresIn` yields an already expired, correctly signed token.
  const signToken = (userId: string, expiresInSeconds: number) =>
    jwtService.sign(
      { sub: userId },
      { secret: process.env.JWT_SECRET, expiresIn: expiresInSeconds }
    );
  const validToken = (userId: string) => signToken(userId, 7 * 24 * 3600);
  const expiredToken = (userId: string) => signToken(userId, -60);
  const wronglySignedToken = (userId: string) =>
    jwtService.sign({ sub: userId }, { secret: 'not-the-jwt-secret' });

  // Mirrors POST /user/refering: unverified, no password, linked to a referer
  // who belongs to an organization.
  const createReferedCandidate = async (
    overrides: { isEmailVerified?: boolean; password?: string | null } = {}
  ) => {
    const organization = await organizationFactory.create({}, {}, true);
    const referer = await userFactory.create({
      role: UserRoles.REFERER,
      OrganizationId: organization.id,
    });
    const candidate = await userFactory.create({
      role: UserRoles.CANDIDATE,
      refererId: referer.id,
    });
    await usersService.update(candidate.id, {
      isEmailVerified: overrides.isEmailVerified ?? false,
      ...(overrides.password === undefined || overrides.password === null
        ? { password: null, salt: null }
        : {}),
    });
    return { candidate, referer, organization };
  };

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
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    organizationFactory =
      moduleFixture.get<OrganizationFactory>(OrganizationFactory);
    usersService = moduleFixture.get<UsersService>(UsersService);
    jwtService = moduleFixture.get<JwtService>(JwtService, { strict: false });
    mailsService = moduleFixture.get<MailsServiceMock>(MailsService);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    throttlerStorage.storage.clear();
    jest.restoreAllMocks();
  });

  describe('/login - account without a password', () => {
    it('Should reject any password as an authentication failure, not a server error', async () => {
      const { candidate } = await createReferedCandidate();

      for (const password of [newPassword, 'anything-else']) {
        const response = await request(server)
          .post(`${route}/login`)
          .send({ email: candidate.email, password });
        expect(response.status).toBe(401);
      }
    });

    it('Should reject an empty password without a server error', async () => {
      const { candidate } = await createReferedCandidate();

      const response = await request(server)
        .post(`${route}/login`)
        .send({ email: candidate.email, password: '' });
      // Rejected upstream by LocalStrategy, as for any account.
      expect(response.status).toBeLessThan(500);
      expect(response.status).not.toBe(201);
    });
  });

  describe('/finalize-refered-user - Finalize account', () => {
    it('Should verify the email, set the password and notify the referer, if valid token', async () => {
      const { candidate } = await createReferedCandidate();
      const welcomeSpy = jest.spyOn(mailsService, 'sendWelcomeMail');
      const refererSpy = jest.spyOn(
        mailsService,
        'sendRefererCandidateHasVerifiedAccountMail'
      );

      const response = await request(server)
        .post(`${route}/finalize-refered-user`)
        .send({ token: validToken(candidate.id), password: newPassword });
      expect(response.status).toBe(201);

      const updated = await usersService.findOneComplete(candidate.id);
      expect(updated.isEmailVerified).toBe(true);
      expect(updated.password).not.toBeNull();
      expect(welcomeSpy).toHaveBeenCalledTimes(1);
      expect(refererSpy).toHaveBeenCalledTimes(1);

      const login = await request(server)
        .post(`${route}/login`)
        .send({ email: candidate.email, password: newPassword });
      expect(login.status).toBe(201);
    });

    it('Should return 400 TOKEN_EXPIRED and leave the account untouched, if expired token', async () => {
      const { candidate } = await createReferedCandidate();

      const response = await request(server)
        .post(`${route}/finalize-refered-user`)
        .send({ token: expiredToken(candidate.id), password: newPassword });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('TOKEN_EXPIRED');

      const unchanged = await usersService.findOneComplete(candidate.id);
      expect(unchanged.isEmailVerified).toBe(false);
      expect(unchanged.password).toBeNull();
    });

    it('Should return 400 INVALID_TOKEN, if wrongly signed token', async () => {
      const { candidate } = await createReferedCandidate();

      const response = await request(server)
        .post(`${route}/finalize-refered-user`)
        .send({
          token: wronglySignedToken(candidate.id),
          password: newPassword,
        });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('INVALID_TOKEN');
    });

    it('Should return 400 EMAIL_ALREADY_VERIFIED, if the account is already finalized', async () => {
      const { candidate } = await createReferedCandidate({
        isEmailVerified: true,
        password: 'kept',
      });

      const response = await request(server)
        .post(`${route}/finalize-refered-user`)
        .send({ token: validToken(candidate.id), password: newPassword });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('EMAIL_ALREADY_VERIFIED');
    });

    // Guards `isReferedCandidateAccountFinalized` against being reduced to
    // `isEmailVerified`: such accounts exist (verified through the J+1
    // relaunch mail's autologin link) and must still be able to finalize.
    it('Should accept finalization, if the email is verified but no password was ever chosen', async () => {
      const { candidate } = await createReferedCandidate({
        isEmailVerified: true,
      });
      const refererSpy = jest.spyOn(
        mailsService,
        'sendRefererCandidateHasVerifiedAccountMail'
      );

      const response = await request(server)
        .post(`${route}/finalize-refered-user`)
        .send({ token: validToken(candidate.id), password: newPassword });
      expect(response.status).toBe(201);
      expect(refererSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('/send-finalize-refered-user - Request a new activation link', () => {
    it('Should resend the referral activation mail with a new token, if expired token', async () => {
      const { candidate, referer, organization } =
        await createReferedCandidate();
      const finalizeSpy = jest.spyOn(
        mailsService,
        'sendReferedCandidateFinalizeAccountMail'
      );
      const verificationSpy = jest.spyOn(mailsService, 'sendVerificationMail');
      const refererSpy = jest.spyOn(
        mailsService,
        'sendRefererCandidateHasVerifiedAccountMail'
      );

      const response = await request(server)
        .post(`${route}/send-finalize-refered-user`)
        .send({ token: expiredToken(candidate.id) });
      expect(response.status).toBe(201);

      expect(finalizeSpy).toHaveBeenCalledTimes(1);
      const [sentReferer, sentCandidate, sentToken] = finalizeSpy.mock
        .calls[0] as [User, User, string];
      expect(sentCandidate.id).toBe(candidate.id);
      expect(sentReferer.id).toBe(referer.id);
      // The mail reads `referer.organization.name`: the referer must be loaded
      // as a root user, not through the nested `candidate.referer` relation.
      expect(sentReferer.organization?.name).toBe(organization.name);

      // Not the generic email verification mail, and the referer is not told.
      expect(verificationSpy).not.toHaveBeenCalled();
      expect(refererSpy).not.toHaveBeenCalled();

      // The new link actually finalizes the account.
      const finalize = await request(server)
        .post(`${route}/finalize-refered-user`)
        .send({ token: sentToken, password: newPassword });
      expect(finalize.status).toBe(201);
    });

    it('Should return 400 and send nothing, if no token', async () => {
      const finalizeSpy = jest.spyOn(
        mailsService,
        'sendReferedCandidateFinalizeAccountMail'
      );

      const response = await request(server)
        .post(`${route}/send-finalize-refered-user`)
        .send({ email: 'someone@example.com' });
      expect(response.status).toBe(400);
      expect(finalizeSpy).not.toHaveBeenCalled();
    });

    it('Should return 400 INVALID_TOKEN and send nothing, if wrongly signed token', async () => {
      const { candidate } = await createReferedCandidate();
      const finalizeSpy = jest.spyOn(
        mailsService,
        'sendReferedCandidateFinalizeAccountMail'
      );

      const response = await request(server)
        .post(`${route}/send-finalize-refered-user`)
        .send({ token: wronglySignedToken(candidate.id) });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('INVALID_TOKEN');
      expect(finalizeSpy).not.toHaveBeenCalled();
    });

    it('Should return 400 EMAIL_ALREADY_VERIFIED and send nothing, if the account is already finalized', async () => {
      const { candidate } = await createReferedCandidate({
        isEmailVerified: true,
        password: 'kept',
      });
      const finalizeSpy = jest.spyOn(
        mailsService,
        'sendReferedCandidateFinalizeAccountMail'
      );

      const response = await request(server)
        .post(`${route}/send-finalize-refered-user`)
        .send({ token: expiredToken(candidate.id) });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('EMAIL_ALREADY_VERIFIED');
      expect(finalizeSpy).not.toHaveBeenCalled();
    });

    it('Should return 400 INVALID_TOKEN and send nothing, if the account was not refered', async () => {
      const candidate = await userFactory.create({ role: UserRoles.CANDIDATE });
      await usersService.update(candidate.id, { isEmailVerified: false });
      const finalizeSpy = jest.spyOn(
        mailsService,
        'sendReferedCandidateFinalizeAccountMail'
      );

      const response = await request(server)
        .post(`${route}/send-finalize-refered-user`)
        .send({ token: expiredToken(candidate.id) });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('INVALID_TOKEN');
      expect(finalizeSpy).not.toHaveBeenCalled();
    });

    it('Should rate limit repeated requests', async () => {
      const { candidate } = await createReferedCandidate();
      const token = expiredToken(candidate.id);

      const statuses: number[] = [];
      for (let i = 0; i < 6; i += 1) {
        const response = await request(server)
          .post(`${route}/send-finalize-refered-user`)
          .send({ token });
        statuses.push(response.status);
      }
      expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
      expect(statuses[5]).toBe(429);
    });
  });
});
