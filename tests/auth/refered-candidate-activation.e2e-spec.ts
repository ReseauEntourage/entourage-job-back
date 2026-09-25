import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { encryptOtp } from 'src/auth/auth.utils';
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
import { AuthHelper } from './auth.helper';

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
  let authHelper: AuthHelper;

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
    authHelper = moduleFixture.get<AuthHelper>(AuthHelper);
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

  describe('/finalize-account - Finalize account', () => {
    it('Should verify the email, set the password and notify the referer, if valid token', async () => {
      const { candidate } = await createReferedCandidate();
      const welcomeSpy = jest.spyOn(mailsService, 'sendWelcomeMail');
      const refererSpy = jest.spyOn(
        mailsService,
        'sendRefererCandidateHasVerifiedAccountMail'
      );

      const response = await request(server)
        .post(`${route}/finalize-account`)
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
        .post(`${route}/finalize-account`)
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
        .post(`${route}/finalize-account`)
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
        .post(`${route}/finalize-account`)
        .send({ token: validToken(candidate.id), password: newPassword });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('EMAIL_ALREADY_VERIFIED');
    });

    // Guards `isAccountFinalized` against being reduced to
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
        .post(`${route}/finalize-account`)
        .send({ token: validToken(candidate.id), password: newPassword });
      expect(response.status).toBe(201);
      expect(refererSpy).toHaveBeenCalledTimes(1);
    });
  });

  // Session obtained through an autologin link, the entry point of a refered
  // candidate who clicks on the notification of a message sent by an admin.
  const getAutologinSession = async (userId: string) => {
    const autologinToken = await authHelper.getAutologinToken(userId);
    const response = await request(server)
      .post(`${route}/autologin`)
      .send({ token: autologinToken });
    expect(response.status).toBe(201);
    return response.body.token as string;
  };

  describe('Restricted session - account without a password', () => {
    it('Should accept the session despite the unverified email, but only on the identity route', async () => {
      const { candidate } = await createReferedCandidate();
      const sessionToken = await getAutologinSession(candidate.id);

      const identity = await request(server)
        .get('/current')
        .set('authorization', `Bearer ${sessionToken}`);
      expect(identity.status).toBe(200);
      expect(identity.body.hasPassword).toBe(false);
      expect(identity.body.password).toBeUndefined();

      const profile = await request(server)
        .get('/current/profile')
        .set('authorization', `Bearer ${sessionToken}`);
      expect(profile.status).toBe(403);
      expect(profile.body.message).toBe('PASSWORD_SETUP_REQUIRED');
    });

    it('Should let the session log out', async () => {
      const { candidate } = await createReferedCandidate();
      const sessionToken = await getAutologinSession(candidate.id);

      const response = await request(server)
        .post(`${route}/logout`)
        .set('authorization', `Bearer ${sessionToken}`);
      expect(response.status).toBe(302);
    });

    it('Should restrict the session the same way after a verify-otp', async () => {
      const { candidate } = await createReferedCandidate();
      const { hash, salt } = encryptOtp('123456');
      await usersService.update(candidate.id, {
        otpCode: hash,
        otpSalt: salt,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const otp = await request(server)
        .post(`${route}/verify-otp`)
        .send({ email: candidate.email, code: '123456' });
      expect(otp.status).toBe(201);

      const profile = await request(server)
        .get('/current/profile')
        .set('authorization', `Bearer ${otp.body.token}`);
      expect(profile.status).toBe(403);
      expect(profile.body.message).toBe('PASSWORD_SETUP_REQUIRED');
    });

    it('Should still reject with 401 UNVERIFIED_EMAIL an unverified account that has a password', async () => {
      const candidate = await userFactory.create({ role: UserRoles.CANDIDATE });
      await usersService.update(candidate.id, { isEmailVerified: false });
      const sessionToken = await getAutologinSession(candidate.id);

      const identity = await request(server)
        .get('/current')
        .set('authorization', `Bearer ${sessionToken}`);
      expect(identity.status).toBe(401);
      expect(identity.body.message).toBe('UNVERIFIED_EMAIL');
    });

    it('Should not restrict an account that has a password', async () => {
      const candidate = await userFactory.create({ role: UserRoles.CANDIDATE });
      const sessionToken = await getAutologinSession(candidate.id);

      const identity = await request(server)
        .get('/current')
        .set('authorization', `Bearer ${sessionToken}`);
      expect(identity.status).toBe(200);
      expect(identity.body.hasPassword).toBe(true);
      expect(identity.body.password).toBeUndefined();

      const profile = await request(server)
        .get('/current/profile')
        .set('authorization', `Bearer ${sessionToken}`);
      expect(profile.status).toBe(200);
    });
  });

  describe('/finalize-account - Finalize account from a session', () => {
    it('Should finalize the account and lift the restriction, if the session has no password', async () => {
      const { candidate } = await createReferedCandidate();
      const welcomeSpy = jest.spyOn(mailsService, 'sendWelcomeMail');
      const refererSpy = jest.spyOn(
        mailsService,
        'sendRefererCandidateHasVerifiedAccountMail'
      );
      const sessionToken = await getAutologinSession(candidate.id);

      const response = await request(server)
        .post(`${route}/finalize-account`)
        .set('authorization', `Bearer ${sessionToken}`)
        .send({ password: newPassword });
      expect(response.status).toBe(201);

      const updated = await usersService.findOneComplete(candidate.id);
      expect(updated.isEmailVerified).toBe(true);
      expect(updated.password).not.toBeNull();
      expect(welcomeSpy).toHaveBeenCalledTimes(1);
      expect(refererSpy).toHaveBeenCalledTimes(1);

      // The same session now has full access.
      const profile = await request(server)
        .get('/current/profile')
        .set('authorization', `Bearer ${sessionToken}`);
      expect(profile.status).toBe(200);

      const login = await request(server)
        .post(`${route}/login`)
        .send({ email: candidate.email, password: newPassword });
      expect(login.status).toBe(201);
    });

    it('Should return 400 EMAIL_ALREADY_VERIFIED and keep the password, if the session account already has one', async () => {
      const candidate = await userFactory.create({ role: UserRoles.CANDIDATE });
      const { password: previousHash } = await usersService.findOneComplete(
        candidate.id
      );
      const sessionToken = await getAutologinSession(candidate.id);

      const response = await request(server)
        .post(`${route}/finalize-account`)
        .set('authorization', `Bearer ${sessionToken}`)
        .send({ password: newPassword });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('EMAIL_ALREADY_VERIFIED');

      const unchanged = await usersService.findOneComplete(candidate.id);
      expect(unchanged.password).toBe(previousHash);
    });

    it('Should finalize the account of the token, if both a token and a session of another account are present', async () => {
      const { candidate } = await createReferedCandidate();
      const other = await userFactory.create({ role: UserRoles.CANDIDATE });
      const sessionToken = await getAutologinSession(other.id);

      const response = await request(server)
        .post(`${route}/finalize-account`)
        .set('authorization', `Bearer ${sessionToken}`)
        .send({ token: validToken(candidate.id), password: newPassword });
      expect(response.status).toBe(201);
      expect(response.text).toBe(candidate.email);

      const updated = await usersService.findOneComplete(candidate.id);
      expect(updated.password).not.toBeNull();
    });

    it('Should return 400 INVALID_TOKEN, if neither a token nor a session is present', async () => {
      const response = await request(server)
        .post(`${route}/finalize-account`)
        .send({ password: newPassword });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('INVALID_TOKEN');
    });

    it('Should finalize an account without a referer, without notifying any referer', async () => {
      const user = await userFactory.create({ role: UserRoles.CANDIDATE });
      await usersService.update(user.id, {
        isEmailVerified: false,
        password: null,
        salt: null,
      });
      const welcomeSpy = jest.spyOn(mailsService, 'sendWelcomeMail');
      const refererSpy = jest.spyOn(
        mailsService,
        'sendRefererCandidateHasVerifiedAccountMail'
      );
      const sessionToken = await getAutologinSession(user.id);

      const response = await request(server)
        .post(`${route}/finalize-account`)
        .set('authorization', `Bearer ${sessionToken}`)
        .send({ password: newPassword });
      expect(response.status).toBe(201);
      expect(welcomeSpy).toHaveBeenCalledTimes(1);
      expect(refererSpy).not.toHaveBeenCalled();
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
        .post(`${route}/finalize-account`)
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
