import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ContactsController } from 'src/contacts/contacts.controller';
import { MailjetService } from 'src/external-services/mailjet/mailjet.service';
import { ContactStatus } from 'src/external-services/mailjet/mailjet.types';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { Queues } from 'src/queues/queues.types';
import { AdminZones, APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import {
  CacheMocks,
  MailjetMock,
  QueueMocks,
  SalesforceMocks,
} from 'tests/mocks.types';
import { ContactCandidateFormFactory } from './contact-candidate-form.factory';
import { ContactCompanyFormFactory } from './contact-company-form.factory';
import { ContactUsFormFactory } from './contact-us-form.factory';
import { InscriptionCandidateFormFactory } from './inscription-candidate-form.factory';

describe('Contacts', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let contactUsFormFactory: ContactUsFormFactory;
  let contactCompanyFormFactory: ContactCompanyFormFactory;
  let contactCandidateFormFactory: ContactCandidateFormFactory;
  let inscriptionCandidateFormFactory: InscriptionCandidateFormFactory;

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
      .overrideProvider(MailjetService)
      .useValue(MailjetMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    contactUsFormFactory =
      moduleFixture.get<ContactUsFormFactory>(ContactUsFormFactory);
    contactCompanyFormFactory = moduleFixture.get<ContactCompanyFormFactory>(
      ContactCompanyFormFactory
    );
    contactCandidateFormFactory =
      moduleFixture.get<ContactCandidateFormFactory>(
        ContactCandidateFormFactory
      );
    inscriptionCandidateFormFactory =
      moduleFixture.get<InscriptionCandidateFormFactory>(
        InscriptionCandidateFormFactory
      );
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('/contactUs - Send contact form answers to contact mail', () => {
    it('Should return 201, if all content provided', async () => {
      const formAnswers = await contactUsFormFactory.create({});
      const response: APIResponse<ContactsController['sendMailContactUsForm']> =
        await request(app.getHttpServer())
          .post(`${route}/contactUs`)
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
          .post(`${route}/contactUs`)
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
          .post(`${route}/contactUs`)
          .send(shortData);
      expect(response.status).toBe(400);
    });
  });

  describe('/company - Send contact form answers to salesforce', () => {
    it('Should return 201, if all content provided', async () => {
      const formAnswers = await contactCompanyFormFactory.create({});
      const response: APIResponse<ContactsController['sendCompanyForm']> =
        await request(app.getHttpServer())
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

      const response: APIResponse<ContactsController['sendCompanyForm']> =
        await request(app.getHttpServer())
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

      const response: APIResponse<ContactsController['sendCompanyForm']> =
        await request(app.getHttpServer())
          .post(`${route}/company`)
          .send(shortData);
      expect(response.status).toBe(400);
    });
  });

  describe('/candidate - Send candidate form answers to salesforce', () => {
    it('Should return 201, if all content provided', async () => {
      const formAnswers = await contactCandidateFormFactory.create({});
      const response: APIResponse<ContactsController['sendCandidateForm']> =
        await request(app.getHttpServer())
          .post(`${route}/candidate`)
          .send(formAnswers);
      expect(response.status).toBe(201);
    });

    it('Should return 201, if optional fields not provided', async () => {
      const formAnswers = await contactCandidateFormFactory.create({});

      const shortData = {
        firstName: formAnswers.firstName,
        lastName: formAnswers.lastName,
        phone: formAnswers.phone,
        email: formAnswers.email,
        postalCode: formAnswers.postalCode,
        structure: formAnswers.structure,
        workerFirstName: formAnswers.workerFirstName,
        workerLastName: formAnswers.workerLastName,
        workerPhone: formAnswers.workerPhone,
        workerEmail: formAnswers.workerEmail,
        workingRight: formAnswers.workingRight,
        accommodation: formAnswers.accommodation,
        domiciliation: formAnswers.domiciliation,
        socialSecurity: formAnswers.socialSecurity,
        bankAccount: formAnswers.bankAccount,
        city: formAnswers.city,
        helpWith: formAnswers.helpWith,
        gender: formAnswers.gender,
        professionalSituation: formAnswers.professionalSituation,
        registeredUnemploymentOffice: formAnswers.registeredUnemploymentOffice,
        description: formAnswers.description,
        heardAbout: formAnswers.heardAbout,
      };

      const response: APIResponse<ContactsController['sendCandidateForm']> =
        await request(app.getHttpServer())
          .post(`${route}/candidate`)
          .send(shortData);
      expect(response.status).toBe(201);
    });

    it('Should return 400, if missing mandatory fields', async () => {
      const formAnswers = await contactCandidateFormFactory.create({});

      const shortData = {
        firstName: formAnswers.firstName,
        lastName: formAnswers.lastName,
      };

      const response: APIResponse<ContactsController['sendCandidateForm']> =
        await request(app.getHttpServer())
          .post(`${route}/candidate`)
          .send(shortData);
      expect(response.status).toBe(400);
    });
  });

  describe('/newsletter - Subscribe contact email to newsletter list', () => {
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

  describe('/campaigns - Get all the campaigns in the future', () => {
    it('should return 201 on route call', async () => {
      const response: APIResponse<ContactsController['getCampaigns']> =
        await request(app.getHttpServer()).get(`${route}/campaigns`).send();
      expect(response.status).toBe(200);
    });
  });

  describe('/candidateInscription - Post candidate inscription form', () => {
    it('should return 201 on route call with complete data', async () => {
      const formAnswers = await inscriptionCandidateFormFactory.create({});

      const shortData = {
        firstName: formAnswers.firstName,
        lastName: formAnswers.lastName,
        email: formAnswers.email,
        birthdate: formAnswers.birthdate,
        workingRight: formAnswers.workingRight,
        heardAbout: formAnswers.heardAbout,
        phone: formAnswers.phone,
        location: formAnswers.location,
        infoCo: formAnswers.infoCo,
      };

      const response: APIResponse<ContactsController['candidateInscription']> =
        await request(app.getHttpServer())
          .post(`${route}/candidateInscription`)
          .send(shortData);
      expect(response.status).toBe(201);
    });
    it('should return 201 on route call without infoCo', async () => {
      const formAnswers = await inscriptionCandidateFormFactory.create({});

      const shortData = {
        firstName: formAnswers.firstName,
        lastName: formAnswers.lastName,
        email: formAnswers.email,
        birthdate: formAnswers.birthdate,
        workingRight: formAnswers.workingRight,
        heardAbout: formAnswers.heardAbout,
        phone: formAnswers.phone,
        location: formAnswers.location,
      };

      const response: APIResponse<ContactsController['candidateInscription']> =
        await request(app.getHttpServer())
          .post(`${route}/candidateInscription`)
          .send(shortData);
      expect(response.status).toBe(201);
    });

    it('should return 400 with missing property', async () => {
      const formAnswers = await inscriptionCandidateFormFactory.create({});

      const shortData = {
        firstName: formAnswers.firstName,
        lastName: formAnswers.lastName,
        email: formAnswers.email,
        birthdate: formAnswers.birthdate,
        workingRight: formAnswers.workingRight,
        heardAbout: formAnswers.heardAbout,
        // phone: formAnswers.phone,
        location: formAnswers.location,
      };

      const response: APIResponse<ContactsController['candidateInscription']> =
        await request(app.getHttpServer())
          .post(`${route}/candidateInscription`)
          .send(shortData);
      expect(response.status).toBe(400);
    });
  });
});
