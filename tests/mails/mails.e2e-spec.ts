import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { MailsController } from 'src/mails/mails.controller';
import { ContactStatus } from 'src/mails/mails.types';
import { Queues } from 'src/queues/queues.types';
import { AdminZones, APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { CacheMocks, QueueMocks } from 'tests/mocks.types';
import { ContactUsFormFactory } from './contact-us-form.factory';

describe('Mails', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let contactUsFormFactory: ContactUsFormFactory;

  const route = '/mail';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(QueueMocks)
      .overrideProvider(CACHE_MANAGER)
      .useValue(CacheMocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    contactUsFormFactory =
      moduleFixture.get<ContactUsFormFactory>(ContactUsFormFactory);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('/contact-us - Send contact form answers to contact mail', () => {
    it('Should return 201, if all content provided', async () => {
      const formAnswers = await contactUsFormFactory.create({});
      const response: APIResponse<MailsController['sendMailContactUsForm']> =
        await request(app.getHttpServer())
          .post(`${route}/contact-us`)
          .send(formAnswers);
      expect(response.status).toBe(201);
    });

    it('Should return 201, if optional fields not provided', async () => {
      const formAnswers = await contactUsFormFactory.create({});

      const shortData = {
        firstName: formAnswers.firstName,
        lastName: formAnswers.lastName,
        email: formAnswers.email,
        message: formAnswers.message,
      };

      const response: APIResponse<MailsController['sendMailContactUsForm']> =
        await request(app.getHttpServer())
          .post(`${route}/contact-us`)
          .send(shortData);
      expect(response.status).toBe(201);
    });

    it('Should return 400, if missing mandatory fields', async () => {
      const formAnswers = await contactUsFormFactory.create({});

      const shortData = {
        firstName: formAnswers.firstName,
        lastName: formAnswers.lastName,
      };

      const response: APIResponse<MailsController['sendMailContactUsForm']> =
        await request(app.getHttpServer())
          .post(`${route}/contact-us`)
          .send(shortData);
      expect(response.status).toBe(400);
    });
  });

  describe('/newsletter - Subscribe contact email to newsletter list', () => {
    it('Should return 201, if all content provided', async () => {
      const response: APIResponse<MailsController['addContactForNewsletter']> =
        await request(app.getHttpServer())
          .post(`${route}/newsletter`)
          .send({
            email: 'john@gmail.com',
            zone: AdminZones.LYON,
            status: 'PARTICULIER' as ContactStatus,
          });
      expect(response.status).toBe(201);
    });

    it('Should return 201, if optional fields not provided', async () => {
      const response: APIResponse<MailsController['addContactForNewsletter']> =
        await request(app.getHttpServer()).post(`${route}/newsletter`).send({
          email: 'john@gmail.com',
        });
      expect(response.status).toBe(201);
    });

    it('Should return 400, if missing email', async () => {
      const response: APIResponse<MailsController['addContactForNewsletter']> =
        await request(app.getHttpServer())
          .post(`${route}/newsletter`)
          .send({
            email: null,
            zone: AdminZones.LYON,
            status: 'PARTICULIER' as ContactStatus,
          });
      expect(response.status).toBe(400);
    });
  });
});
