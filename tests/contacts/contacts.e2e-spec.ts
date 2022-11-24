import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ContactsController } from 'src/contacts/contacts.controller';
import { ContactsService } from 'src/contacts/contacts.service';
import { PleziService } from 'src/external-services/plezi/plezi.service';
import { ContactStatus } from 'src/external-services/plezi/plezi.types';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { Queues } from 'src/queues/queues.types';
import { AdminZones, APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import {
  CacheMocks,
  PleziMocks,
  QueueMocks,
  SalesforceMocks,
} from 'tests/mocks.types';
import { ContactCompanyFormFactory } from './contact-company-form.factory';
import { ContactUsFormFactory } from './contact-us-form.factory';

describe('Contacts', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let contactUsFormFactory: ContactUsFormFactory;
  let contactCompanyFormFactory: ContactCompanyFormFactory;

  const route = '/contact';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(QueueMocks)
      .overrideProvider(CACHE_MANAGER)
      .useValue(CacheMocks)
      .overrideProvider(SalesforceService)
      .useValue(SalesforceMocks)
      .overrideProvider(PleziService)
      .useValue(PleziMocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    contactUsFormFactory =
      moduleFixture.get<ContactUsFormFactory>(ContactUsFormFactory);
    contactCompanyFormFactory = moduleFixture.get<ContactCompanyFormFactory>(
      ContactCompanyFormFactory
    );
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
      const response: APIResponse<ContactsController['sendMailContactUsForm']> =
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
        cgu: formAnswers.cgu,
      };

      const response: APIResponse<ContactsController['sendMailContactUsForm']> =
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

      const response: APIResponse<ContactsController['sendMailContactUsForm']> =
        await request(app.getHttpServer())
          .post(`${route}/contact-us`)
          .send(shortData);
      expect(response.status).toBe(400);
    });
  });

  describe('/company - Send contact form answers to salesforce', () => {
    it('Should return 201, if all content provided', async () => {
      const formAnswers = await contactCompanyFormFactory.create({});
      const response: APIResponse<
        ContactsController['sendMailContactCompanyForm']
      > = await request(app.getHttpServer())
        .post(`${route}/company`)
        .send(formAnswers);
      expect(response.status).toBe(201);
    });

    it('Should return 201, if optional fields not provided', async () => {
      const formAnswers = await contactCompanyFormFactory.create({});

      const shortData = {
        firstName: formAnswers.firstName,
        lastName: formAnswers.lastName,
        email: formAnswers.email,
        zone: formAnswers.zone,
        company: formAnswers.company,
        position: formAnswers.position,
        approach: formAnswers.approach,
      };

      const response: APIResponse<
        ContactsController['sendMailContactCompanyForm']
      > = await request(app.getHttpServer())
        .post(`${route}/company`)
        .send(shortData);
      expect(response.status).toBe(201);
    });

    it('Should return 400, if missing mandatory fields', async () => {
      const formAnswers = await contactCompanyFormFactory.create({});

      const shortData = {
        firstName: formAnswers.firstName,
        lastName: formAnswers.lastName,
      };

      const response: APIResponse<
        ContactsController['sendMailContactCompanyForm']
      > = await request(app.getHttpServer())
        .post(`${route}/company`)
        .send(shortData);
      expect(response.status).toBe(400);
    });
  });

  describe('/newsletter - Subscribe contact email to newsletter list', () => {
    beforeEach(() => {
      jest
        .spyOn(ContactsService.prototype, 'sendContactToPlezi')
        .mockImplementationOnce(async () => null);
    });

    it('Should return 201, if all content provided', async () => {
      const response: APIResponse<
        ContactsController['addContactForNewsletter']
      > = await request(app.getHttpServer())
        .post(`${route}/newsletter`)
        .send({
          email: 'john@gmail.com',
          zone: AdminZones.LYON,
          status: 'PARTICULIER' as ContactStatus,
        });
      expect(response.status).toBe(201);
    });

    it('Should return 201, if optional fields not provided', async () => {
      const response: APIResponse<
        ContactsController['addContactForNewsletter']
      > = await request(app.getHttpServer()).post(`${route}/newsletter`).send({
        email: 'john@gmail.com',
      });
      expect(response.status).toBe(201);
    });

    it('Should return 400, if missing email', async () => {
      const response: APIResponse<
        ContactsController['addContactForNewsletter']
      > = await request(app.getHttpServer())
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
