import { randomBytes, randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { encryptOtp } from 'src/auth/auth.utils';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { MailsServiceMock } from 'tests/mails/mails.service.mock';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

// Email verification endpoints of /auth: verify-email, send-verify-email and verify-otp.
// All of them are public: every role goes through the same checks, the role matrix below
// makes sure none of them is accidentally restricted or privileged.
describe('Auth - email verification', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersService: UsersService;
  let jwtService: JwtService;
  let throttlerStorage: ThrottlerStorageService;

  const route = '/auth';
  const sign = (userId: string, expiresIn: number) =>
    jwtService.sign(
      { sub: userId },
      { secret: process.env.JWT_SECRET, expiresIn }
    );
  const validToken = (userId: string) => sign(userId, 7 * 24 * 3600);
  const expiredToken = (userId: string) => sign(userId, -60);

  const createUnverifiedUser = async (
    role: (typeof UserRoles)[keyof typeof UserRoles] = UserRoles.CANDIDATE
  ) => {
    const user = await userFactory.create({ role });
    await usersService.update(user.id, {
      isEmailVerified: false,
      lastConnection: null,
    });
    return user;
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
    databaseHelper = moduleFixture.get(DatabaseHelper);
    userFactory = moduleFixture.get(UserFactory);
    usersService = moduleFixture.get(UsersService);
    jwtService = moduleFixture.get(JwtService, { strict: false });
    throttlerStorage = moduleFixture.get(ThrottlerStorage);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    // Also cancel the pending expiry timers: once the storage is cleared, a stale timer would
    // fire on a missing entry and crash a later test
    throttlerStorage.storage.clear();
    const { timeoutIds } = throttlerStorage as unknown as {
      timeoutIds: Map<string, NodeJS.Timeout[]>;
    };
    timeoutIds.forEach((ids) => ids.forEach(clearTimeout));
    timeoutIds.clear();
    jest.restoreAllMocks();
  });

  describe('POST /auth/verify-email', () => {
    it.each([
      UserRoles.CANDIDATE,
      UserRoles.COACH,
      UserRoles.REFERER,
      UserRoles.ADMIN,
    ])(
      'verifies the email of a %s and sends the welcome mail on the first verification',
      async (role) => {
        const welcomeMail = jest.spyOn(
          app.get<MailsServiceMock>(MailsService),
          'sendWelcomeMail'
        );
        const user = await createUnverifiedUser(role);

        const response = await request(server)
          .post(`${route}/verify-email`)
          .send({ token: validToken(user.id) });

        expect(response.status).toBe(201);
        expect((await usersService.findOne(user.id)).isEmailVerified).toBe(
          true
        );
        expect(welcomeMail).toHaveBeenCalledTimes(1);
      }
    );

    it('does not send the welcome mail again to a user who already connected', async () => {
      const welcomeMail = jest.spyOn(
        app.get<MailsServiceMock>(MailsService),
        'sendWelcomeMail'
      );
      const user = await createUnverifiedUser();
      await usersService.update(user.id, { lastConnection: new Date() });

      const response = await request(server)
        .post(`${route}/verify-email`)
        .send({ token: validToken(user.id) });

      expect(response.status).toBe(201);
      expect(welcomeMail).not.toHaveBeenCalled();
    });

    it('returns 400 INVALID_TOKEN for a token with a wrong signature', async () => {
      const user = await createUnverifiedUser();
      const forged = jwtService.sign(
        { sub: user.id },
        { secret: randomBytes(16).toString('hex') }
      );

      const response = await request(server)
        .post(`${route}/verify-email`)
        .send({ token: forged });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('INVALID_TOKEN');
      expect((await usersService.findOne(user.id)).isEmailVerified).toBe(false);
    });

    it('returns 400 TOKEN_EXPIRED for an expired token and leaves the account untouched', async () => {
      const user = await createUnverifiedUser();

      const response = await request(server)
        .post(`${route}/verify-email`)
        .send({ token: expiredToken(user.id) });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('TOKEN_EXPIRED');
      expect((await usersService.findOne(user.id)).isEmailVerified).toBe(false);
    });

    it('returns 400 EMAIL_ALREADY_VERIFIED when the email was already verified', async () => {
      const user = await createUnverifiedUser();
      await usersService.update(user.id, { isEmailVerified: true });

      const response = await request(server)
        .post(`${route}/verify-email`)
        .send({ token: validToken(user.id) });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('EMAIL_ALREADY_VERIFIED');
    });

    it('returns 404 when the token targets an unknown user', async () => {
      const response = await request(server)
        .post(`${route}/verify-email`)
        .send({ token: validToken(randomUUID()) });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /auth/send-verify-email', () => {
    it.each([
      UserRoles.CANDIDATE,
      UserRoles.COACH,
      UserRoles.REFERER,
      UserRoles.ADMIN,
    ])(
      'sends a verification mail with a code to a %s, by email',
      async (role) => {
        const sendVerificationMail = jest.spyOn(
          app.get<MailsServiceMock>(MailsService),
          'sendVerificationMail'
        );
        const user = await createUnverifiedUser(role);

        const response = await request(server)
          .post(`${route}/send-verify-email`)
          .send({ email: user.email });

        expect(response.status).toBe(201);
        expect(sendVerificationMail).toHaveBeenCalledWith(
          expect.objectContaining({ id: user.id }),
          expect.any(String),
          expect.stringMatching(/^\d{6}$/)
        );
        const stored = await usersService.findOneByMailWithOtp(user.email);
        expect(stored.otpCode).toEqual(expect.any(String));
        expect(stored.otpExpiresAt.getTime()).toBeGreaterThan(Date.now());
      }
    );

    it('also accepts an (expired) token to identify the user', async () => {
      const sendVerificationMail = jest.spyOn(
        app.get<MailsServiceMock>(MailsService),
        'sendVerificationMail'
      );
      const user = await createUnverifiedUser();

      const response = await request(server)
        .post(`${route}/send-verify-email`)
        .send({ token: expiredToken(user.id) });

      expect(response.status).toBe(201);
      expect(sendVerificationMail).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when neither a token nor an email is given', async () => {
      const response = await request(server)
        .post(`${route}/send-verify-email`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('returns 400 for a token with a wrong signature', async () => {
      const response = await request(server)
        .post(`${route}/send-verify-email`)
        .send({
          token: jwtService.sign({ sub: randomUUID() }, { secret: 'nope' }),
        });

      expect(response.status).toBe(400);
    });

    it('returns 404 for an unknown email or an unknown user token', async () => {
      const unknownEmail = await request(server)
        .post(`${route}/send-verify-email`)
        .send({ email: 'ghost@example.com' });
      expect(unknownEmail.status).toBe(404);

      const unknownUser = await request(server)
        .post(`${route}/send-verify-email`)
        .send({ token: validToken(randomUUID()) });
      expect(unknownUser.status).toBe(404);
    });
  });

  describe('POST /auth/verify-otp', () => {
    // Test code only, generated at runtime
    const otpCode = () => String(100000 + Math.floor(Math.random() * 900000));

    const setOtp = async (
      userId: string,
      code: string,
      expiresInMs = 10 * 60 * 1000
    ) => {
      const { hash, salt } = encryptOtp(code);
      await usersService.update(userId, {
        otpCode: hash,
        otpSalt: salt,
        otpExpiresAt: new Date(Date.now() + expiresInMs),
      });
    };

    it.each([
      UserRoles.CANDIDATE,
      UserRoles.COACH,
      UserRoles.REFERER,
      UserRoles.ADMIN,
    ])(
      'verifies the email of a %s with a valid code and returns a session token',
      async (role) => {
        const user = await createUnverifiedUser(role);
        const code = otpCode();
        await setOtp(user.id, code);

        const response = await request(server)
          .post(`${route}/verify-otp`)
          .send({ email: user.email, code });

        expect(response.status).toBe(201);
        expect(response.body.token).toEqual(expect.any(String));
        expect((await usersService.findOne(user.id)).isEmailVerified).toBe(
          true
        );
        const stored = await usersService.findOneByMailWithOtp(user.email);
        expect(stored.otpCode).toBeNull();
      }
    );

    it('returns 400 when the email or the code is missing', async () => {
      const user = await createUnverifiedUser();

      expect(
        (
          await request(server)
            .post(`${route}/verify-otp`)
            .send({ email: user.email })
        ).status
      ).toBe(400);
      expect(
        (
          await request(server)
            .post(`${route}/verify-otp`)
            .send({ code: '123456' })
        ).status
      ).toBe(400);
    });

    it('returns 404 for an unknown email', async () => {
      const response = await request(server)
        .post(`${route}/verify-otp`)
        .send({ email: 'ghost@example.com', code: otpCode() });

      expect(response.status).toBe(404);
    });

    it('returns 400 OTP_INVALID when no code was ever requested', async () => {
      const user = await createUnverifiedUser();

      const response = await request(server)
        .post(`${route}/verify-otp`)
        .send({ email: user.email, code: otpCode() });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('OTP_INVALID');
    });

    it('returns 400 OTP_EXPIRED when the code is expired', async () => {
      const user = await createUnverifiedUser();
      const code = otpCode();
      await setOtp(user.id, code, -60 * 1000);

      const response = await request(server)
        .post(`${route}/verify-otp`)
        .send({ email: user.email, code });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('OTP_EXPIRED');
    });

    it('returns 400 OTP_INVALID for a wrong code and keeps the account unverified', async () => {
      const user = await createUnverifiedUser();
      const code = otpCode();
      await setOtp(user.id, code);

      const response = await request(server)
        .post(`${route}/verify-otp`)
        .send({
          email: user.email,
          code: code === '000000' ? '111111' : '000000',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('OTP_INVALID');
      expect((await usersService.findOne(user.id)).isEmailVerified).toBe(false);
    });

    it('rate limits repeated attempts', async () => {
      const user = await createUnverifiedUser();
      let lastStatus = 0;

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const response = await request(server)
          .post(`${route}/verify-otp`)
          .send({ email: user.email, code: '000000' });
        lastStatus = response.status;
      }

      expect(lastStatus).toBe(429);
    });
  });
});
