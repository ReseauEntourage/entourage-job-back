import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ContactsController } from 'src/contacts/contacts.controller';
import { MailjetService } from 'src/external-services/mailjet/mailjet.service';
import { ContactStatus } from 'src/external-services/mailjet/mailjet.types';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { AdminZones, APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { MailjetMock, SalesforceMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { ContactCompanyFormFactory } from './contact-company-form.factory';
import { ContactUsFormFactory } from './contact-us-form.factory';

describe('Contacts', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let contactUsFormFactory: ContactUsFormFactory;
  let contactCompanyFormFactory: ContactCompanyFormFactory;

  const route = '/contact';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(SalesforceService)
      .useValue(SalesforceMocks)
      .overrideProvider(MailjetService)
      .useValue(MailjetMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

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
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('/contactUs - Send contact form answers to contact mail', () => {
    it('Should return 201, if all content provided', async () => {
      const formAnswers = await contactUsFormFactory.create({});
      const response: APIResponse<ContactsController['sendMailContactUsForm']> =
        await request(server).post(`${route}/contactUs`).send(formAnswers);
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
        await request(server).post(`${route}/contactUs`).send(shortData);
      expect(response.status).toBe(201);
    });

    it('Should return 400, if missing mandatory fields', async () => {
      const formAnswers = await contactUsFormFactory.create({});

      const shortData = {
        firstName: formAnswers.firstName,
        lastName: formAnswers.lastName,
      };

      const response: APIResponse<ContactsController['sendMailContactUsForm']> =
        await request(server).post(`${route}/contactUs`).send(shortData);
      expect(response.status).toBe(400);
    });
  });

  describe('/company - Send contact form answers to salesforce', () => {
    it('Should return 201, if all content provided', async () => {
      const formAnswers = await contactCompanyFormFactory.create({});
      const response: APIResponse<ContactsController['sendCompanyForm']> =
        await request(server).post(`${route}/company`).send(formAnswers);
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
        await request(server).post(`${route}/company`).send(shortData);
      expect(response.status).toBe(201);
    });

    it('Should return 400, if missing mandatory fields', async () => {
      const formAnswers = await contactCompanyFormFactory.create({});

      const shortData = {
        firstName: formAnswers.firstName,
        lastName: formAnswers.lastName,
      };

      const response: APIResponse<ContactsController['sendCompanyForm']> =
        await request(server).post(`${route}/company`).send(shortData);
      expect(response.status).toBe(400);
    });
  });

  describe('/newsletter - Subscribe contact email to newsletter list', () => {
    it('Should return 201, if all content provided', async () => {
      const response: APIResponse<
        ContactsController['addContactForNewsletter']
      > = await request(server)
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
      > = await request(server).post(`${route}/newsletter`).send({
        email: 'john@gmail.com',
      });
      expect(response.status).toBe(201);
    });

    it('Should return 400, if missing email', async () => {
      const response: APIResponse<
        ContactsController['addContactForNewsletter']
      > = await request(server)
        .post(`${route}/newsletter`)
        .send({
          email: null,
          zone: AdminZones.LYON,
          status: 'PARTICULIER' as ContactStatus,
        });
      expect(response.status).toBe(400);
    });
  });

  describe('/campaigns/candidate - Get all the candidate the campaigns in the future', () => {
    it('should return 201 on route call', async () => {
      const response: APIResponse<ContactsController['getCandidateCampaigns']> =
        await request(server).get(`${route}/campaigns/candidate`).send();
      expect(response.status).toBe(200);
    });
  });
  describe('/campaigns/coach - Get all the coach campaigns in the future', () => {
    it('should return 201 on route call', async () => {
      const response: APIResponse<ContactsController['getCoachCampaigns']> =
        await request(server).get(`${route}/campaigns/coach`).send();
      expect(response.status).toBe(200);
    });
  });

  // to be deleted soon
  // describe('/candidateInscription - Post candidate inscription form', () => {
  //   it('should return 201 on route call with complete data', async () => {
  //     const formAnswers = await inscriptionCandidateFormFactory.create({});

  //     const shortData = {
  //       firstName: formAnswers.firstName,
  //       lastName: formAnswers.lastName,
  //       email: formAnswers.email,
  //       birthdate: formAnswers.birthdate,
  //       workingRight: formAnswers.workingRight,
  //       heardAbout: formAnswers.heardAbout,
  //       phone: formAnswers.phone,
  //       location: formAnswers.location,
  //       infoCo: formAnswers.infoCo,
  //     };

  //     const response: APIResponse<ContactsController['candidateInscription']> =
  //       await request(server)
  //         .post(`${route}/candidateInscription`)
  //         .send(shortData);
  //     expect(response.status).toBe(201);
  //   });
  //   it('should return 201 on route call without infoCo', async () => {
  //     const formAnswers = await inscriptionCandidateFormFactory.create({});

  //     const shortData = {
  //       firstName: formAnswers.firstName,
  //       lastName: formAnswers.lastName,
  //       email: formAnswers.email,
  //       birthdate: formAnswers.birthdate,
  //       workingRight: formAnswers.workingRight,
  //       heardAbout: formAnswers.heardAbout,
  //       phone: formAnswers.phone,
  //       location: formAnswers.location,
  //     };

  //     const response: APIResponse<ContactsController['candidateInscription']> =
  //       await request(server)
  //         .post(`${route}/candidateInscription`)
  //         .send(shortData);
  //     expect(response.status).toBe(201);
  //   });

  //   it('should return 400 with missing property', async () => {
  //     const formAnswers = await inscriptionCandidateFormFactory.create({});

  //     const shortData = {
  //       firstName: formAnswers.firstName,
  //       lastName: formAnswers.lastName,
  //       email: formAnswers.email,
  //       birthdate: formAnswers.birthdate,
  //       workingRight: formAnswers.workingRight,
  //       heardAbout: formAnswers.heardAbout,
  //       // phone: formAnswers.phone,
  //       location: formAnswers.location,
  //     };

  //     const response: APIResponse<ContactsController['candidateInscription']> =
  //       await request(server)
  //         .post(`${route}/candidateInscription`)
  //         .send(shortData);
  //     expect(response.status).toBe(400);
  //   });
  // });
});
