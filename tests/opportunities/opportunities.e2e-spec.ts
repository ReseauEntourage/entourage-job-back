import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  AirtableMocks,
  BitlyMocks,
  CacheMocks,
  QueueMocks,
  SalesforceMocks,
} from '../mocks.types';
import { LoggedUser } from 'src/auth/auth.types';
import { AirtableService } from 'src/external-services/airtable/airtable.service';
import { BitlyService } from 'src/external-services/bitly/bitly.service';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { MailsService } from 'src/mails/mails.service';
import { Opportunity, OpportunityUser } from 'src/opportunities/models';
import { OpportunitiesController } from 'src/opportunities/opportunities.controller';
import {
  OfferAdminTabs,
  OfferStatuses,
} from 'src/opportunities/opportunities.types';
import { Queues } from 'src/queues/queues.types';
import { User } from 'src/users/models/user.model';
import { UserRoles } from 'src/users/users.types';
import { AdminZones, APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { CVFactory } from 'tests/cvs/cv.factory';
import { DatabaseHelper } from 'tests/database.helper';
import { UserCandidatsHelper } from 'tests/users/user-candidats.helper';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';
import { OpportunitiesHelper } from './opportunities.helper';
import { OpportunityUsersHelper } from './opportunity-users.helper';
import { OpportunityFactory } from './opportunity.factory';

describe('Opportunities', () => {
  let app: INestApplication;

  const route = '/opportunity';

  let databaseHelper: DatabaseHelper;
  let opportunitiesHelper: OpportunitiesHelper;
  let opportunityFactory: OpportunityFactory;
  let opportunityUsersHelper: OpportunityUsersHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;
  let userCandidatsHelper: UserCandidatsHelper;
  let cvFactory: CVFactory;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(QueueMocks)
      .overrideProvider(BitlyService)
      .useValue(BitlyMocks)
      .overrideProvider(CACHE_MANAGER)
      .useValue(CacheMocks)
      .overrideProvider(SalesforceService)
      .useValue(SalesforceMocks)
      .overrideProvider(AirtableService)
      .useValue(AirtableMocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    opportunityFactory =
      moduleFixture.get<OpportunityFactory>(OpportunityFactory);
    opportunitiesHelper =
      moduleFixture.get<OpportunitiesHelper>(OpportunitiesHelper);
    opportunityUsersHelper = moduleFixture.get<OpportunityUsersHelper>(
      OpportunityUsersHelper
    );
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    userCandidatsHelper =
      moduleFixture.get<UserCandidatsHelper>(UserCandidatsHelper);
    cvFactory = moduleFixture.get<CVFactory>(CVFactory);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('CRUD Opportunity', () => {
    describe('C - Create 1 Opportunity', () => {
      describe('/ - Create opportunity', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));

          jest
            .spyOn(MailsService.prototype, 'sendContactToPlezi')
            .mockImplementation(async () => null);
        });

        it('Should return 201, if valid opportunity', async () => {
          const opportunity = await opportunityFactory.create(
            { isPublic: true, isValidated: false },
            {},
            false
          );
          const response: APIResponse<OpportunitiesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send(opportunity);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...opportunity,
              date: opportunity.date.toISOString(),
            })
          );
        });
        it('Should return 201, and createById if valid opportunity created by logged in admin', async () => {
          const opportunity = await opportunityFactory.create(
            { isPublic: true, isValidated: false },
            {},
            false
          );
          const response: APIResponse<OpportunitiesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(opportunity);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...opportunity,
              date: opportunity.date.toISOString(),
              createdBy: loggedInAdmin.user.id,
            })
          );
        });
        it('Should return 403, if user sends isAdmin parameter but is not logged in as admin', async () => {
          const opportunity = await opportunityFactory.create(
            { isPublic: true, isValidated: false },
            {},
            false
          );
          const response: APIResponse<OpportunitiesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send({ ...opportunity, isAdmin: true });
          expect(response.status).toBe(403);
        });
        it('Should return 201, if valid opportunity and multiple locations', async () => {
          const { address, department, ...opportunity } =
            await opportunityFactory.create(
              { isPublic: true, isValidated: false },
              {},
              false
            );

          const locations = {
            paris: { address: 'Rue de Paris', department: 'Paris dept' },
            lyon: { address: 'Rue de Lyon', department: 'Lyon dept' },
            lille: { address: 'Rue de Lille', department: 'Lille dept' },
          };
          const response: APIResponse<OpportunitiesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send({
                ...opportunity,
                locations: [locations.paris, locations.lyon, locations.lille],
              });
          expect(response.status).toBe(201);
          expect(response.body.length).toBe(3);
          expect(response.body).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                ...opportunity,
                address: locations.paris.address,
                department: locations.paris.department,
                date: opportunity.date.toISOString(),
              }),
              expect.objectContaining({
                ...opportunity,
                address: locations.lyon.address,
                department: locations.lyon.department,
                date: opportunity.date.toISOString(),
              }),
              expect.objectContaining({
                ...opportunity,
                address: locations.lille.address,
                department: locations.lille.department,
                date: opportunity.date.toISOString(),
              }),
            ])
          );
        });
        it('Should return 400, if invalid opportunity', async () => {
          const opportunity = await opportunityFactory.create({}, {}, false);
          delete opportunity.title;
          const response: APIResponse<OpportunitiesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send(opportunity);
          expect(response.status).toBe(400);
        });
      });
      describe('/external - Create external opportunity', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let candidate: User;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));

          candidate = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
        });

        it('Should return 400, if logged in as candidate and valid opportunity with unauthorized values', async () => {
          const opportunity = await opportunityFactory.create({}, {}, false);
          const candidateId = loggedInCandidate.user.id;
          const newOpportunity = {
            title: opportunity.title,
            company: opportunity.company,
            contract: opportunity.contract,
            startOfContract: opportunity.startOfContract,
            endOfContract: opportunity.endOfContract,
            isPartTime: opportunity.isPartTime,
            department: opportunity.department,
            businessLines: [{ name: 'id', order: 0 }],
          };
          const response: APIResponse<
            OpportunitiesController['createExternal']
          > = await request(app.getHttpServer())
            .post(`${route}/external`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({ candidateId, ...newOpportunity });
          expect(response.status).toBe(400);
        });
        it('Should return 400, if logged in as candidate and invalid opportunity', async () => {
          const opportunity = await opportunityFactory.create({}, {}, false);
          const candidateId = loggedInCandidate.user.id;
          const newOpportunity = {
            title: opportunity.title,
            company: opportunity.company,
            contract: opportunity.contract,
            startOfContract: opportunity.startOfContract,
            endOfContract: opportunity.endOfContract,
            isPartTime: opportunity.isPartTime,
            department: opportunity.department,
          };
          delete newOpportunity.title;

          const response: APIResponse<
            OpportunitiesController['createExternal']
          > = await request(app.getHttpServer())
            .post(`${route}/external`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({ candidateId, ...newOpportunity });

          expect(response.status).toBe(400);
        });
        it('Should return 201, and status be "Contacted", if logged in as candidate and valid opportunity with authorized values', async () => {
          const opportunity = await opportunityFactory.create({}, {}, false);

          const candidateId = loggedInCandidate.user.id;
          const newOpportunity = {
            title: opportunity.title,
            company: opportunity.company,
            contract: opportunity.contract,
            startOfContract: opportunity.startOfContract,
            endOfContract: opportunity.endOfContract,
            isPartTime: opportunity.isPartTime,
            department: opportunity.department,
          };
          const response: APIResponse<
            OpportunitiesController['createExternal']
          > = await request(app.getHttpServer())
            .post(`${route}/external`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({ candidateId, ...newOpportunity });
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...newOpportunity,
              isExternal: true,
              isPublic: false,
              isValidated: true,
            })
          );
          expect(response.body.opportunityUsers.UserId).toMatch(candidateId);
          expect(response.body.opportunityUsers.status).toBe(
            OfferStatuses.CONTACTED.value
          );
        });

        it('Should return 400, if logged in as coach and valid opportunity with unauthorized values', async () => {
          const opportunity = await opportunityFactory.create({}, {}, false);
          const candidateId = loggedInCandidate.user.id;
          const newOpportunity = {
            title: opportunity.title,
            company: opportunity.company,
            contract: opportunity.contract,
            startOfContract: opportunity.startOfContract,
            endOfContract: opportunity.endOfContract,
            isPartTime: opportunity.isPartTime,
            department: opportunity.department,
            businessLines: [{ name: 'id', order: 0 }],
          };
          const response: APIResponse<
            OpportunitiesController['createExternal']
          > = await request(app.getHttpServer())
            .post(`${route}/external`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({ candidateId, ...newOpportunity });
          expect(response.status).toBe(400);
        });
        it('Should return 400, if logged in as coach and invalid opportunity', async () => {
          const opportunity = await opportunityFactory.create({}, {}, false);
          const candidateId = loggedInCandidate.user.id;
          const newOpportunity = {
            title: opportunity.title,
            company: opportunity.company,
            contract: opportunity.contract,
            startOfContract: opportunity.startOfContract,
            endOfContract: opportunity.endOfContract,
            isPartTime: opportunity.isPartTime,
            department: opportunity.department,
            isPublic: opportunity.isPublic,
          };
          delete newOpportunity.title;

          const response: APIResponse<
            OpportunitiesController['createExternal']
          > = await request(app.getHttpServer())
            .post(`${route}/external`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({ candidateId, ...newOpportunity });

          expect(response.status).toBe(400);
        });
        it('Should return 201, and status be "Contacted", if logged in as coach and valid opportunity with authorized values', async () => {
          const opportunity = await opportunityFactory.create({}, {}, false);

          const candidateId = loggedInCandidate.user.id;
          const newOpportunity = {
            title: opportunity.title,
            company: opportunity.company,
            contract: opportunity.contract,
            startOfContract: opportunity.startOfContract,
            endOfContract: opportunity.endOfContract,
            isPartTime: opportunity.isPartTime,
            department: opportunity.department,
          };
          const response: APIResponse<
            OpportunitiesController['createExternal']
          > = await request(app.getHttpServer())
            .post(`${route}/external`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({ candidateId, ...newOpportunity });
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...newOpportunity,
              isExternal: true,
              isPublic: false,
              isValidated: true,
            })
          );
          expect(response.body.opportunityUsers.UserId).toMatch(candidateId);
          expect(response.body.opportunityUsers.status).toBe(
            OfferStatuses.CONTACTED.value
          );
        });

        it("Should return 403, if logged in as coach and creates another candidate's opportunity", async () => {
          const opportunity = await opportunityFactory.create({}, {}, false);
          const candidateId = candidate.id;
          const newOpportunity = {
            title: opportunity.title,
            company: opportunity.company,
            contract: opportunity.contract,
            startOfContract: opportunity.startOfContract,
            endOfContract: opportunity.endOfContract,
            isPartTime: opportunity.isPartTime,
            department: opportunity.department,
            isPublic: opportunity.isPublic,
          };
          delete newOpportunity.title;

          const response: APIResponse<
            OpportunitiesController['createExternal']
          > = await request(app.getHttpServer())
            .post(`${route}/external`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({ candidateId, newOpportunity });

          expect(response.status).toBe(403);
        });
        it('Should return 201, and status be "Contacted", if logged in as admin and valid opportunity', async () => {
          const opportunity = await opportunityFactory.create({}, {}, false);

          const candidateId = loggedInCandidate.user.id;
          const newOpportunity = {
            title: opportunity.title,
            company: opportunity.company,
            contract: opportunity.contract,
            startOfContract: opportunity.startOfContract,
            endOfContract: opportunity.endOfContract,
            isPartTime: opportunity.isPartTime,
            department: opportunity.department,
          };

          const response: APIResponse<
            OpportunitiesController['createExternal']
          > = await request(app.getHttpServer())
            .post(`${route}/external`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({ candidateId, ...newOpportunity });

          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...newOpportunity,
              isExternal: true,
              isPublic: false,
              isValidated: true,
            })
          );
          expect(response.body.opportunityUsers.UserId).toMatch(candidateId);
          expect(response.body.opportunityUsers.status).toBe(
            OfferStatuses.CONTACTED.value
          );
        });
        it('Should return 400, if logged in as admin invalid opportunity', async () => {
          const opportunity = await opportunityFactory.create({}, {}, false);

          const newOpportunity = {
            candidateId: loggedInCandidate.user.id,
            title: opportunity.title,
            company: opportunity.company,
            contract: opportunity.contract,
            startOfContract: opportunity.startOfContract,
            endOfContract: opportunity.endOfContract,
            isPartTime: opportunity.isPartTime,
            department: opportunity.department,
          };

          delete newOpportunity.title;
          const response: APIResponse<
            OpportunitiesController['createExternal']
          > = await request(app.getHttpServer())
            .post(`${route}/external`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(newOpportunity);
          expect(response.status).toBe(400);
        });
        it('Should return 401, if not logged in', async () => {
          const opportunity = await opportunityFactory.create({}, {}, false);
          const response = await request(app.getHttpServer())
            .post(`${route}/external`)
            .send(opportunity);
          expect(response.status).toBe(401);
        });
      });
    });
    describe('C - Open 1 Opportunity', () => {
      describe('/join - Add a candidate to an opportunity', () => {
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let candidate: User;
        let publicOpportunity: Opportunity;
        let privateOpportunity: Opportunity;
        let notValidatedOpportunity: Opportunity;

        beforeEach(async () => {
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));

          candidate = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });

          publicOpportunity = await opportunityFactory.create({
            isValidated: true,
            isPublic: true,
          });

          privateOpportunity = await opportunityFactory.create({
            isValidated: true,
            isPublic: false,
          });

          notValidatedOpportunity = await opportunityFactory.create({
            isValidated: false,
            isPublic: true,
          });
        });

        it('Should return 201, if candidate adds himself to a public opportunity', async () => {
          const opportunityId = publicOpportunity.id;
          const body = {
            opportunityId,
            userId: loggedInCandidate.user.id,
          };
          const response: APIResponse<
            OpportunitiesController['createOpportunityUser']
          > = await request(app.getHttpServer())
            .post(`${route}/join`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(body);
          expect(response.status).toBe(201);
          expect(response.body.OpportunityId).toEqual(opportunityId);
          expect(response.body.UserId).toEqual(loggedInCandidate.user.id);
        });
        it('Should return 201, if a coach adds his associated candidate to a public opportunity', async () => {
          const opportunityId = publicOpportunity.id;
          const body = {
            opportunityId,
            userId: loggedInCandidate.user.id,
          };
          const response: APIResponse<
            OpportunitiesController['createOpportunityUser']
          > = await request(app.getHttpServer())
            .post(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(body);
          expect(response.status).toBe(201);
          expect(response.body.OpportunityId).toEqual(opportunityId);
          expect(response.body.UserId).toEqual(loggedInCandidate.user.id);
        });
        it('Should return 201, if admin adds candidate to an opportunity', async () => {
          const opportunityId = publicOpportunity.id;
          const body = {
            opportunityId,
            userId: loggedInCandidate.user.id,
          };
          const response: APIResponse<
            OpportunitiesController['createOpportunityUser']
          > = await request(app.getHttpServer())
            .post(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(body);
          expect(response.status).toBe(201);
          expect(response.body.OpportunityId).toEqual(opportunityId);
          expect(response.body.UserId).toEqual(loggedInCandidate.user.id);
        });
        it('Should return 400, if invalid opportunity id', async () => {
          const opportunityId = '1111-invalid-99999';
          const body = {
            opportunityId,
            userId: loggedInCandidate.user.id,
          };
          const response: APIResponse<
            OpportunitiesController['createOpportunityUser']
          > = await request(app.getHttpServer())
            .post(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(body);
          expect(response.status).toBe(400);
        });
        it('Should return 403, if candidate updates an other candidate', async () => {
          const opportunityId = publicOpportunity.id;
          const body = {
            opportunityId,
            userId: candidate,
          };
          const response: APIResponse<
            OpportunitiesController['createOpportunityUser']
          > = await request(app.getHttpServer())
            .post(`${route}/join`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(body);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if a coach updates not associate candidate', async () => {
          const opportunityId = publicOpportunity.id;
          const body = {
            opportunityId,
            userId: candidate.id,
          };
          const response: APIResponse<
            OpportunitiesController['createOpportunityUser']
          > = await request(app.getHttpServer())
            .post(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(body);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if candidate adds himself to private opportunity', async () => {
          const opportunityId = privateOpportunity.id;
          const body = {
            opportunityId,
            userId: loggedInCandidate.user.id,
          };
          const response: APIResponse<
            OpportunitiesController['createOpportunityUser']
          > = await request(app.getHttpServer())
            .post(`${route}/join`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(body);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if a coach adds his candidate to private opportunity', async () => {
          const opportunityId = privateOpportunity.id;
          const body = {
            opportunityId,
            userId: loggedInCandidate.user.id,
          };
          const response: APIResponse<
            OpportunitiesController['createOpportunityUser']
          > = await request(app.getHttpServer())
            .post(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(body);
          expect(response.status).toBe(403);
        });

        it('Should return 403, if candidate adds himself to not validated opportunity', async () => {
          const opportunityId = notValidatedOpportunity.id;
          const body = {
            opportunityId,
            userId: loggedInCandidate.user.id,
          };
          const response: APIResponse<
            OpportunitiesController['createOpportunityUser']
          > = await request(app.getHttpServer())
            .post(`${route}/join`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(body);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if a coach adds his candidate to private opportunity', async () => {
          const opportunityId = notValidatedOpportunity.id;
          const body = {
            opportunityId,
            userId: loggedInCandidate.user.id,
          };
          const response: APIResponse<
            OpportunitiesController['createOpportunityUser']
          > = await request(app.getHttpServer())
            .post(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(body);
          expect(response.status).toBe(403);
        });
      });
    });
    describe('R - Read 1 Opportunity', () => {
      describe('/:id - Get one opportunity', () => {
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let loggedInAdmin: LoggedUser;
        let candidate: User;
        let privateOpportunity: Opportunity;
        let publicOpportunity: Opportunity;
        let notValidatedOpportunity: Opportunity;
        let otherPrivateOpportunity: Opportunity;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));

          candidate = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });

          publicOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
            isPublic: true,
          });

          privateOpportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
            isPublic: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            privateOpportunity.id,
            loggedInCandidate.user.id
          );

          notValidatedOpportunity = await opportunityFactory.create({
            isValidated: false,
            isArchived: false,
            isPublic: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            notValidatedOpportunity.id,
            loggedInCandidate.user.id
          );

          otherPrivateOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
            isPublic: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            otherPrivateOpportunity.id,
            candidate.id
          );
        });

        it('Should return 200, if candidate reads one of his opportunity', async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${privateOpportunity.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);

          const {
            beContacted,
            contactMail,
            isArchived,
            opportunityUsers,
            recruiterPhone,
            ...restPrivateOpportunity
          } = privateOpportunity;

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restPrivateOpportunity,
              createdAt: restPrivateOpportunity.updatedAt.toISOString(),
              updatedAt: restPrivateOpportunity.createdAt.toISOString(),
              date: restPrivateOpportunity.date.toISOString(),
            })
          );
        });
        it("Should return 200, if a coach reads his associated candidate's opportunity", async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${privateOpportunity.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);

          const {
            beContacted,
            contactMail,
            isArchived,
            opportunityUsers,
            recruiterPhone,
            ...restPrivateOpportunity
          } = privateOpportunity;

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restPrivateOpportunity,
              createdAt: restPrivateOpportunity.updatedAt.toISOString(),
              updatedAt: restPrivateOpportunity.createdAt.toISOString(),
              date: restPrivateOpportunity.date.toISOString(),
            })
          );
        });
        it('Should return 200, if admin reads a private opportunity', async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${privateOpportunity.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);

          const { opportunityUsers, ...restPrivateOpportunity } =
            privateOpportunity;

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restPrivateOpportunity,
              createdAt: restPrivateOpportunity.updatedAt.toISOString(),
              updatedAt: restPrivateOpportunity.createdAt.toISOString(),
              date: restPrivateOpportunity.date.toISOString(),
            })
          );
        });
        it('Should return 200, if candidate reads a public opportunity', async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${publicOpportunity.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);

          const {
            beContacted,
            contactMail,
            isArchived,
            opportunityUsers,
            recruiterPhone,
            ...responsePublicOpportunity
          } = publicOpportunity;

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...responsePublicOpportunity,
              createdAt: responsePublicOpportunity.updatedAt.toISOString(),
              updatedAt: responsePublicOpportunity.createdAt.toISOString(),
              date: responsePublicOpportunity.date.toISOString(),
            })
          );
        });
        it('Should return 200, if coach reads a public opportunity', async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${publicOpportunity.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);

          const {
            beContacted,
            contactMail,
            isArchived,
            opportunityUsers,
            recruiterPhone,
            ...responsePublicOpportunity
          } = publicOpportunity;

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...responsePublicOpportunity,
              createdAt: responsePublicOpportunity.updatedAt.toISOString(),
              updatedAt: responsePublicOpportunity.createdAt.toISOString(),
              date: responsePublicOpportunity.date.toISOString(),
            })
          );
        });
        it('Should return 200, if admin reads a public opportunity', async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${publicOpportunity.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...publicOpportunity,
              createdAt: publicOpportunity.updatedAt.toISOString(),
              updatedAt: publicOpportunity.createdAt.toISOString(),
              date: publicOpportunity.date.toISOString(),
            })
          );
        });
        it('Should return 404, if candidate reads an opportunity not associated to him', async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${otherPrivateOpportunity.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(404);
        });
        it('Should return 404, if coach reads an opportunity of another candidate', async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${otherPrivateOpportunity.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(404);
        });
        it('Should return 404, if candidate reads an opportunity associated to him but not validated', async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${notValidatedOpportunity.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(404);
        });
        it('Should return 404, if coach reads an opportunity associated to his candidate but not validated', async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${notValidatedOpportunity.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(404);
        });
        it('Should return 401, if user not logged in', async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer()).get(
              `${route}/${privateOpportunity.id}`
            );
          expect(response.status).toBe(401);
        });
      });
    });
    describe('R - Read many Opportunities', () => {
      describe('/admin?search=&type=&businessLines[]=&status[]=&isPublic[]&department[]= - Read all opportunities as admin matching specific filters', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });

          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
        });

        it('Should return 403, if not logged in admin', async () => {
          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/admin`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200 and a list of all opportunities, if logged in admin and no filters', async () => {
          const firstOpportunity = await opportunityFactory.create({});

          const secondpportunity = await opportunityFactory.create({});

          const thirdOpportunity = await opportunityFactory.create({});

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondpportunity.id,
            thirdOpportunity.id,
          ];

          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/admin`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(3);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the search query', async () => {
          const searchedOpportunity = await opportunityFactory.create({
            title: 'XXXXX',
          });

          await opportunityFactory.create({
            title: 'AZERTY',
          });

          await opportunityFactory.create({
            title: 'AZERTY',
          });

          const expectedOpportunitiesId = [searchedOpportunity.id];

          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/admin?search=XXXXX`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(1);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the pending filter', async () => {
          const firstPendingOpportunity = await opportunityFactory.create({
            isValidated: false,
            isArchived: false,
            isExternal: false,
          });

          const secondPendingOpportunity = await opportunityFactory.create({
            isValidated: false,
            isArchived: false,
            isExternal: false,
          });

          await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
            isExternal: false,
          });

          const expectedOpportunitiesId = [
            firstPendingOpportunity.id,
            secondPendingOpportunity.id,
          ];

          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/admin?type=${OfferAdminTabs.PENDING}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the validated filter', async () => {
          const firstValidatedOpportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
            isExternal: false,
          });

          const secondValidatedOpportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
            isExternal: false,
          });

          await opportunityFactory.create({
            isValidated: false,
            isArchived: false,
            isExternal: false,
          });

          const expectedOpportunitiesId = [
            firstValidatedOpportunity.id,
            secondValidatedOpportunity.id,
          ];
          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/admin?type=validated`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the external filter', async () => {
          const firstExternalOpportunity = await opportunityFactory.create({
            isExternal: true,
          });

          const secondExternalOpportunity = await opportunityFactory.create({
            isExternal: true,
          });

          await opportunityFactory.create({
            isExternal: false,
          });

          const expectedOpportunitiesId = [
            firstExternalOpportunity.id,
            secondExternalOpportunity.id,
          ];

          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/admin?type=${OfferAdminTabs.EXTERNAL}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the archived filter', async () => {
          const firstArchivedOpportunity = await opportunityFactory.create({
            isArchived: true,
          });

          const secondArchivedOpportunity = await opportunityFactory.create({
            isArchived: true,
          });

          await opportunityFactory.create({
            isArchived: false,
          });

          const expectedOpportunitiesId = [
            firstArchivedOpportunity.id,
            secondArchivedOpportunity.id,
          ];

          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/admin?type=${OfferAdminTabs.ARCHIVED}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the department filters', async () => {
          const firstOpportunity = await opportunityFactory.create({
            department: 'Rhône (69)',
          });

          const secondOpportunity = await opportunityFactory.create({
            department: 'Rhône (69)',
          });

          const thirdOpportunity = await opportunityFactory.create({
            department: 'Nord (59)',
          });

          await opportunityFactory.create({
            department: 'Paris (75)',
          });

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
            thirdOpportunity.id,
          ];

          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(
                `${route}/admin?department[]=Rhône (69)&department[]=Nord (59)`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(3);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the isPublic filters', async () => {
          const firstOpportunity = await opportunityFactory.create({
            isPublic: true,
          });

          const secondOpportunity = await opportunityFactory.create({
            isPublic: true,
          });

          await opportunityFactory.create({
            isPublic: false,
          });

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
          ];

          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/admin?isPublic[]=true`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the businessLines filters', async () => {
          const firstOpportunity = await opportunityFactory.create(
            {},
            { businessLines: ['id', 'bat'] }
          );

          const secondOpportunity = await opportunityFactory.create(
            {},
            { businessLines: ['bat'] }
          );

          const thirdOpportunity = await opportunityFactory.create(
            {},
            { businessLines: ['id'] }
          );

          await opportunityFactory.create({}, { businessLines: ['asp'] });

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
            thirdOpportunity.id,
          ];

          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/admin?businessLines[]=id&businessLines[]=bat`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(3);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the status filters', async () => {
          const newUser1 = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
          const firstOpportunity = await opportunityFactory.create({});
          await opportunityUsersHelper.associateOpportunityUser(
            firstOpportunity.id,
            newUser1.id,
            { status: OfferStatuses.INTERVIEW.value }
          );

          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
          const secondOpportunity = await opportunityFactory.create({});
          await opportunityUsersHelper.associateOpportunityUser(
            secondOpportunity.id,
            newUser2.id,
            { status: OfferStatuses.HIRED.value }
          );

          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
          const thirdOpportunity = await opportunityFactory.create({});
          await opportunityUsersHelper.associateOpportunityUser(
            thirdOpportunity.id,
            newUser3.id,
            { status: OfferStatuses.CONTACTED.value }
          );

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
          ];

          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(
                `${route}/admin?status[]=${OfferStatuses.INTERVIEW.value}&status[]=${OfferStatuses.HIRED.value}`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
      });
      describe('/admin/count - Count all pending opportunities as admin', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
            zone: AdminZones.LYON,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });

          await databaseHelper.createEntities(opportunityFactory, 3, {
            isValidated: false,
            isArchived: false,
            department: 'Rhône (69)',
          });

          await databaseHelper.createEntities(opportunityFactory, 3, {
            isValidated: false,
            isArchived: false,
            department: 'Paris (75)',
          });
        });

        it('Should return 200 and count of all pending opportunities, if logged in admin', async () => {
          const response: APIResponse<OpportunitiesController['countPending']> =
            await request(app.getHttpServer())
              .get(`${route}/admin/count`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.pendingOpportunities).toBe(3);
        });
        it('Should return 403, if not logged in admin', async () => {
          const response: APIResponse<OpportunitiesController['countPending']> =
            await request(app.getHttpServer())
              .get(`${route}/admin/count`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
      });
      describe("/user/private/:id?search=&type=&businessLines[]=&status[]=&isPublic[]&department[]= - Read a user's private opportunities as admin", () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });

          ({ loggedInCandidate, loggedInCoach } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
        });

        it('Should return 403, if candidate reads his opportunities', async () => {
          const response: APIResponse<
            OpportunitiesController['findAllUserOpportunitiesAsAdmin']
          > = await request(app.getHttpServer())
            .get(`${route}/user/private/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if a coach reads his associated candidate opportunities', async () => {
          const response: APIResponse<
            OpportunitiesController['findAllUserOpportunitiesAsAdmin']
          > = await request(app.getHttpServer())
            .get(`${route}/user/private/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 400, if invalid user id', async () => {
          const response: APIResponse<
            OpportunitiesController['findAllUserOpportunitiesAsAdmin']
          > = await request(app.getHttpServer())
            .get(`${route}/user/private/1111-invalid-99999`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(400);
        });
        it("Should return 200, if a admin reads candidate's opportunities without filters", async () => {
          const opportunities = await databaseHelper.createEntities(
            opportunityFactory,
            3,
            { isArchived: false, isValidated: true }
          );

          await opportunityUsersHelper.associateManyOpportunityUsers(
            opportunities.map(({ id }) => id),
            loggedInCandidate.user.id,
            { archived: false }
          );

          const expectedOpportunitiesId = opportunities.map(({ id }) => id);

          const response: APIResponse<
            OpportunitiesController['findAllUserOpportunitiesAsAdmin']
          > = await request(app.getHttpServer())
            .get(`${route}/user/private/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(3);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the hide public filter', async () => {
          const firstOpportunity = await opportunityFactory.create({
            isPublic: true,
            isArchived: false,
            isValidated: true,
          });

          const secondOpportunity = await opportunityFactory.create({
            isPublic: true,
            isArchived: false,
            isValidated: true,
          });

          const thirdOpportunity = await opportunityFactory.create({
            isPublic: false,
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateManyOpportunityUsers(
            [firstOpportunity.id, secondOpportunity.id, thirdOpportunity.id],
            loggedInCandidate.user.id,
            { archived: false }
          );

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
          ];

          const response: APIResponse<
            OpportunitiesController['findAllUserOpportunitiesAsAdmin']
          > = await request(app.getHttpServer())
            .get(
              `${route}/user/private/${loggedInCandidate.user.id}?isPublic[]=true`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the department filters', async () => {
          const firstOpportunity = await opportunityFactory.create({
            department: 'Rhône (69)',
            isArchived: false,
            isValidated: true,
          });

          const secondOpportunity = await opportunityFactory.create({
            department: 'Rhône (69)',
            isArchived: false,
            isValidated: true,
          });

          const thirdOpportunity = await opportunityFactory.create({
            department: 'Nord (59)',
            isArchived: false,
            isValidated: true,
          });

          const fourthOpportunity = await opportunityFactory.create({
            department: 'Paris (75)',
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateManyOpportunityUsers(
            [
              firstOpportunity.id,
              secondOpportunity.id,
              thirdOpportunity.id,
              fourthOpportunity.id,
            ],
            loggedInCandidate.user.id,
            { archived: false }
          );

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
            thirdOpportunity.id,
          ];

          const response: APIResponse<
            OpportunitiesController['findAllUserOpportunitiesAsAdmin']
          > = await request(app.getHttpServer())
            .get(
              `${route}/user/private/${loggedInCandidate.user.id}?department[]=Rhône (69)&department[]=Nord (59)`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(3);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the status filters', async () => {
          const firstOpportunity = await opportunityFactory.create({});
          await opportunityUsersHelper.associateOpportunityUser(
            firstOpportunity.id,
            loggedInCandidate.user.id,
            { status: OfferStatuses.INTERVIEW.value }
          );

          const secondOpportunity = await opportunityFactory.create({});
          await opportunityUsersHelper.associateOpportunityUser(
            secondOpportunity.id,
            loggedInCandidate.user.id,
            { status: OfferStatuses.HIRED.value }
          );

          const thirdOpportunity = await opportunityFactory.create({});
          await opportunityUsersHelper.associateOpportunityUser(
            thirdOpportunity.id,
            loggedInCandidate.user.id,
            { status: OfferStatuses.CONTACTED.value }
          );

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
          ];

          const response: APIResponse<
            OpportunitiesController['findAllUserOpportunitiesAsAdmin']
          > = await request(app.getHttpServer())
            .get(
              `${route}/user/private/${loggedInCandidate.user.id}?status[]=1&status[]=2`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the businessLines filters', async () => {
          const firstOpportunity = await opportunityFactory.create(
            {},
            { businessLines: ['id', 'bat'] }
          );

          const secondOpportunity = await opportunityFactory.create(
            {},
            { businessLines: ['bat'] }
          );

          const thirdOpportunity = await opportunityFactory.create(
            {},
            { businessLines: ['id'] }
          );

          const fourthOpportunity = await opportunityFactory.create(
            {},
            { businessLines: ['asp'] }
          );

          await opportunityUsersHelper.associateManyOpportunityUsers(
            [
              firstOpportunity.id,
              secondOpportunity.id,
              thirdOpportunity.id,
              fourthOpportunity.id,
            ],
            loggedInCandidate.user.id,
            { status: OfferStatuses.CONTACTED.value }
          );

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
            thirdOpportunity.id,
          ];

          const response: APIResponse<
            OpportunitiesController['findAllUserOpportunitiesAsAdmin']
          > = await request(app.getHttpServer())
            .get(
              `${route}/user/private/${loggedInCandidate.user.id}?businessLines[]=id&businessLines[]=bat`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(3);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the search query', async () => {
          const searchedOpportunity = await opportunityFactory.create({
            title: 'XXXXX',
          });

          const secondOpportunity = await opportunityFactory.create({
            title: 'AZERTY',
          });

          const thirdOpportunity = await opportunityFactory.create({
            title: 'AZERTY',
          });

          await opportunityUsersHelper.associateManyOpportunityUsers(
            [searchedOpportunity.id, secondOpportunity.id, thirdOpportunity.id],
            loggedInCandidate.user.id,
            { status: OfferStatuses.CONTACTED.value }
          );

          const expectedOpportunitiesId = [searchedOpportunity.id];

          const response: APIResponse<
            OpportunitiesController['findAllUserOpportunitiesAsAdmin']
          > = await request(app.getHttpServer())
            .get(
              `${route}/user/private/${loggedInCandidate.user.id}?search=XXXXX`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(1);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
      });
      describe("/user/all/:id?search=&type=&businessLines[]=&status[]=&department[]= - Read all user's opportunities", () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let candidate: User;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          candidate = await userFactory.create({ role: UserRoles.CANDIDAT });

          ({ loggedInCandidate, loggedInCoach } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
        });

        it('Should return 403, if a admin reads a candidates opportunities', async () => {
          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/user/all/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 400, if invalid user id', async () => {
          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/user/all/1111-invalid-99999`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if candidate reads an other candidate opportunities', async () => {
          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/user/all/${candidate.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it("Should return 403, if a coach reads not associate candidate's opportunities", async () => {
          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/user/all/${candidate.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });

        it('Should return 200, if candidate reads his opportunities without filters', async () => {
          const opportunities = await databaseHelper.createEntities(
            opportunityFactory,
            3,
            { isArchived: false, isValidated: true }
          );

          await opportunityUsersHelper.associateManyOpportunityUsers(
            opportunities.map(({ id }) => id),
            loggedInCandidate.user.id,
            { archived: false }
          );

          const expectedOpportunitiesId = opportunities.map(({ id }) => id);

          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/user/all/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(3);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.offers.map(({ id }) => id))
          );
        });
        it('Should return 200, if a coach reads his associated candidate opportunities without filters', async () => {
          const opportunities = await databaseHelper.createEntities(
            opportunityFactory,
            3,
            { isArchived: false, isValidated: true }
          );

          await opportunityUsersHelper.associateManyOpportunityUsers(
            opportunities.map(({ id }) => id),
            loggedInCandidate.user.id,
            { archived: false }
          );

          const expectedOpportunitiesId = opportunities.map(({ id }) => id);

          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/user/all/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(3);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.offers.map(({ id }) => id))
          );
        });

        it('Should return 200, and all the opportunities that matches the private filter', async () => {
          const firstOpportunity = await opportunityFactory.create({
            isPublic: false,
            isArchived: false,
            isValidated: true,
          });

          const secondOpportunity = await opportunityFactory.create({
            isPublic: false,
            isArchived: false,
            isValidated: true,
          });

          const thirdOpportunity = await opportunityFactory.create({
            isPublic: true,
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateManyOpportunityUsers(
            [firstOpportunity.id, secondOpportunity.id, thirdOpportunity.id],
            loggedInCandidate.user.id,
            { archived: false }
          );

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
          ];

          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/user/all/${loggedInCandidate.user.id}?type=private`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.offers.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the public filter', async () => {
          const firstOpportunity = await opportunityFactory.create({
            isPublic: true,
            isArchived: false,
            isValidated: true,
          });

          const secondOpportunity = await opportunityFactory.create({
            isPublic: true,
            isArchived: false,
            isValidated: true,
          });

          const thirdOpportunity = await opportunityFactory.create({
            isPublic: false,
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateManyOpportunityUsers(
            [firstOpportunity.id, secondOpportunity.id, thirdOpportunity.id],
            loggedInCandidate.user.id,
            { archived: false }
          );

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
          ];

          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/user/all/${loggedInCandidate.user.id}?type=public`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.offers.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the archived filter', async () => {
          const firstArchivedOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
          });

          const secondArchivedOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
          });

          const thirdOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateManyOpportunityUsers(
            [firstArchivedOpportunity.id, secondArchivedOpportunity.id],
            loggedInCandidate.user.id,
            { archived: true }
          );

          await opportunityUsersHelper.associateOpportunityUser(
            thirdOpportunity.id,
            loggedInCandidate.user.id,
            { archived: false }
          );

          const expectedOpportunitiesId = [
            firstArchivedOpportunity.id,
            secondArchivedOpportunity.id,
          ];

          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/user/all/${loggedInCandidate.user.id}?type=archived`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.offers.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the department filters', async () => {
          const firstOpportunity = await opportunityFactory.create({
            department: 'Rhône (69)',
            isArchived: false,
            isValidated: true,
          });

          const secondOpportunity = await opportunityFactory.create({
            department: 'Rhône (69)',
            isArchived: false,
            isValidated: true,
          });

          const thirdOpportunity = await opportunityFactory.create({
            department: 'Nord (59)',
            isArchived: false,
            isValidated: true,
          });

          const fourthOpportunity = await opportunityFactory.create({
            department: 'Paris (75)',
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateManyOpportunityUsers(
            [
              firstOpportunity.id,
              secondOpportunity.id,
              thirdOpportunity.id,
              fourthOpportunity.id,
            ],
            loggedInCandidate.user.id,
            { archived: false }
          );

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
            thirdOpportunity.id,
          ];

          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(
              `${route}/user/all/${loggedInCandidate.user.id}?department[]=Rhône (69)&department[]=Nord (59)`
            )
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(3);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.offers.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the businessLines filters', async () => {
          const firstOpportunity = await opportunityFactory.create(
            { isArchived: false, isValidated: true },
            { businessLines: ['id', 'bat'] }
          );

          const secondOpportunity = await opportunityFactory.create(
            { isArchived: false, isValidated: true },
            { businessLines: ['bat'] }
          );

          const thirdOpportunity = await opportunityFactory.create(
            { isArchived: false, isValidated: true },
            { businessLines: ['id'] }
          );

          const fourthOpportunity = await opportunityFactory.create(
            { isArchived: false, isValidated: true },
            { businessLines: ['asp'] }
          );

          await opportunityUsersHelper.associateManyOpportunityUsers(
            [
              firstOpportunity.id,
              secondOpportunity.id,
              thirdOpportunity.id,
              fourthOpportunity.id,
            ],
            loggedInCandidate.user.id,
            { archived: false }
          );

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
            thirdOpportunity.id,
          ];

          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(
              `${route}/user/all/${loggedInCandidate.user.id}?businessLines[]=id&businessLines[]=bat`
            )
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(3);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.offers.map(({ id }) => id))
          );
        });
        it("Should return 200, and offers suggestions of different location if the department filters don't match", async () => {
          const firstOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
            isPublic: false,
            department: 'Rhône (69)',
          });

          const secondOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
            isPublic: false,
            department: 'Rhône (69)',
          });

          const thirdOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
            isPublic: false,
            department: 'Ain (01)',
          });

          const fourthOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
            isPublic: false,
            department: 'Paris (75)',
          });

          await opportunityUsersHelper.associateManyOpportunityUsers(
            [
              firstOpportunity.id,
              secondOpportunity.id,
              thirdOpportunity.id,
              fourthOpportunity.id,
            ],
            loggedInCandidate.user.id,
            { archived: false }
          );

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
          ];

          const expectedOtherOpportunitiesId = [
            thirdOpportunity.id,
            fourthOpportunity.id,
          ];

          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(
              `${route}/user/all/${loggedInCandidate.user.id}?department[]=Rhône (69)&type=private`
            )
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(2);
          expect(response.body.otherOffers.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.offers.map(({ id }) => id))
          );
          expect(expectedOtherOpportunitiesId).toEqual(
            expect.arrayContaining(
              response.body.otherOffers.map(({ id }) => id)
            )
          );
        });
        it('Should return 200, and all the opportunities that matches the status filters', async () => {
          const firstOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
          });
          await opportunityUsersHelper.associateOpportunityUser(
            firstOpportunity.id,
            loggedInCandidate.user.id,
            { status: OfferStatuses.INTERVIEW.value, archived: false }
          );

          const secondOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
          });
          await opportunityUsersHelper.associateOpportunityUser(
            secondOpportunity.id,
            loggedInCandidate.user.id,
            { status: OfferStatuses.HIRED.value, archived: false }
          );

          const thirdOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
          });
          await opportunityUsersHelper.associateOpportunityUser(
            thirdOpportunity.id,
            loggedInCandidate.user.id,
            { status: OfferStatuses.CONTACTED.value, archived: false }
          );

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondOpportunity.id,
          ];

          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(
              `${route}/user/all/${loggedInCandidate.user.id}?status[]=${OfferStatuses.INTERVIEW.value}&status[]=${OfferStatuses.HIRED.value}`
            )
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.offers.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the opportunities that matches the search query', async () => {
          const searchedOpportunity = await opportunityFactory.create({
            title: 'XXXXX',
            isArchived: false,
            isValidated: true,
          });

          const secondOpportunity = await opportunityFactory.create({
            title: 'AZERTY',
            isArchived: false,
            isValidated: true,
          });

          const thirdOpportunity = await opportunityFactory.create({
            title: 'AZERTY',
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateManyOpportunityUsers(
            [searchedOpportunity.id, secondOpportunity.id, thirdOpportunity.id],
            loggedInCandidate.user.id,
            { archived: false }
          );

          const expectedOpportunitiesId = [searchedOpportunity.id];

          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/user/all/${loggedInCandidate.user.id}?search=XXXXX`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(1);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.offers.map(({ id }) => id))
          );
        });
      });
      describe("/user/count/:id - Count all new user's opportunities", () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let candidate: User;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          candidate = await userFactory.create({ role: UserRoles.CANDIDAT });

          ({ loggedInCandidate, loggedInCoach } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));

          await cvFactory.create(
            { UserId: loggedInCandidate.user.id },
            { locations: ['Rhône (69)'] }
          );

          const opportunities = await databaseHelper.createEntities(
            opportunityFactory,
            3,
            {
              isArchived: false,
              isValidated: true,
              department: 'Rhône (69)',
            }
          );

          const otherOpportunities = await databaseHelper.createEntities(
            opportunityFactory,
            3,
            {
              isArchived: false,
              isValidated: true,
              department: 'Ain (01)',
            }
          );

          await opportunityUsersHelper.associateManyOpportunityUsers(
            [
              ...opportunities.map(({ id }) => id),
              ...otherOpportunities.map(({ id }) => id),
            ],
            loggedInCandidate.user.id,
            { seen: false, archived: false }
          );
        });

        it('Should return 200, if candidate counts his unseen opportunities', async () => {
          const response: APIResponse<OpportunitiesController['countUnseen']> =
            await request(app.getHttpServer())
              .get(`${route}/user/count/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.unseenOpportunities).toBe(3);
        });
        it("Should return 200, if a coach counts his associated candidate's unseen opportunities", async () => {
          const response: APIResponse<OpportunitiesController['countUnseen']> =
            await request(app.getHttpServer())
              .get(`${route}/user/count/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.unseenOpportunities).toBe(3);
        });
        it("Should return 403, if a admin counts a candidate's unseen opportunities", async () => {
          const response: APIResponse<OpportunitiesController['countUnseen']> =
            await request(app.getHttpServer())
              .get(`${route}/user/count/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it("Should return 403, if candidate counts an other candidate's unseen opportunities", async () => {
          const response: APIResponse<OpportunitiesController['countUnseen']> =
            await request(app.getHttpServer())
              .get(`${route}/user/count/${candidate.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it("Should return 403, if a coach counts not associate candidate's unseen opportunities", async () => {
          const response: APIResponse<OpportunitiesController['countUnseen']> =
            await request(app.getHttpServer())
              .get(`${route}/user/count/${candidate.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
      });
    });
    describe('U - Update 1 Opportunity', () => {
      describe('/ - Update an opportunity', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let opportunity: Opportunity;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });

          opportunity = await opportunityFactory.create({});
        });

        it('Should return 200, if admin updates an opportunity', async () => {
          const update = {
            id: opportunity.id,
            title: 'updated title',
          };
          const response: APIResponse<OpportunitiesController['update']> =
            await request(app.getHttpServer())
              .put(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(update);
          expect(response.status).toBe(200);
          expect(response.body.title).toBe('updated title');
        });

        it('Should return 200, if admin adds a user to a public opportunity', async () => {
          const update = {
            id: opportunity.id,
            candidatesId: [loggedInCandidate.user.id],
          };
          const response: APIResponse<OpportunitiesController['update']> =
            await request(app.getHttpServer())
              .put(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(update);
          expect(response.status).toBe(200);
          expect(
            response.body.opportunityUsers.map((userOpp: OpportunityUser) => {
              return userOpp.UserId;
            })
          ).toEqual(expect.arrayContaining([loggedInCandidate.user.id]));
        });
        it('Should return 403, if not an admin', async () => {
          const update = {
            ...opportunity,
            title: 'updated title',
          };
          const response: APIResponse<OpportunitiesController['update']> =
            await request(app.getHttpServer())
              .put(`${route}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send(update);
          expect(response.status).toBe(403);
        });
      });
      describe('/external - Update an external opportunity', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let candidate: User;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });

          candidate = await userFactory.create({ role: UserRoles.CANDIDAT });

          ({ loggedInCandidate, loggedInCoach } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
        });

        it('Should return 200, if logged in as candidate and updates own opportunity with authorized values', async () => {
          const opportunity = await opportunityFactory.create({
            isExternal: true,
            isArchived: false,
            isValidated: true,
            isPublic: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id
          );

          const newTitle = 'Updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: opportunity.id,
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining(updatedOpportunity)
          );
          expect(response.body.opportunityUsers.UserId).toMatch(candidateId);
        });

        it('Should return 400, if logged in as candidate and updates own opportunity with unauthorized values', async () => {
          const opportunity = await opportunityFactory.create({
            isExternal: true,
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id
          );

          const newTitle = 'updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: opportunity.id,
            title: newTitle,
            businessLines: [{ name: 'id', order: 0 }],
          };
          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(400);
        });
        it('Should return 403, if logged in as candidate and updates somebody elses opportunity', async () => {
          const opportunity = await opportunityFactory.create({
            isExternal: true,
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            candidate.id
          );

          const newTitle = 'updated title';
          const candidateId = candidate.id;
          const updatedOpportunity = {
            id: opportunity.id,
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(403);
        });
        it('Should return 404, if logged in as candidate and updates non external opportunity', async () => {
          const opportunity = await opportunityFactory.create({
            isExternal: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id
          );

          const newTitle = 'updated title';

          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: opportunity.id,
            title: newTitle,
          };
          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(404);
        });

        it('Should return 200, if logged in as coach and updates own candidate opportunity with authorized values', async () => {
          const opportunity = await opportunityFactory.create({
            isExternal: true,
            isArchived: false,
            isValidated: true,
            isPublic: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id
          );

          const newTitle = 'Updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: opportunity.id,
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining(updatedOpportunity)
          );
          expect(response.body.opportunityUsers.UserId).toMatch(candidateId);
        });
        it('Should return 400, if logged in as coach and updates own candidate opportunity with unauthorized values', async () => {
          const opportunity = await opportunityFactory.create({
            isExternal: true,
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id
          );

          const newTitle = 'updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            title: newTitle,
            businessLines: [{ name: 'id', order: 0 }],
          };
          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(400);
        });
        it("Should return 403, if logged in as coach and creates another candidate's opportunity", async () => {
          const opportunity = await opportunityFactory.create({
            isExternal: true,
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            candidate.id
          );

          const newTitle = 'updated title';

          const candidateId = candidate.id;
          const updatedOpportunity = {
            id: opportunity.id,
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(403);
        });

        it('Should return 200, if logged in as admin and updates opportunity', async () => {
          const opportunity = await opportunityFactory.create({
            isExternal: true,
            isArchived: false,
            isValidated: true,
            isPublic: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id
          );

          const newTitle = 'updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: opportunity.id,
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining(updatedOpportunity)
          );
          expect(response.body.opportunityUsers.UserId).toMatch(candidateId);
        });
        it('Should return 404, if logged in as admin and updates non external opportunity', async () => {
          const opportunity = await opportunityFactory.create({
            isExternal: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id
          );

          const newTitle = 'updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: opportunity.id,
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(404);
        });
        it('Should return 400, if logged in as admin and updates opportunity without candidateId', async () => {
          const opportunity = await opportunityFactory.create({
            isExternal: true,
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id
          );

          const newTitle = 'updated title';
          const updatedOpportunity = {
            id: opportunity.id,
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(updatedOpportunity);
          expect(response.status).toBe(400);
        });

        it('Should return 401, if not logged in', async () => {
          const opportunity = await opportunityFactory.create({
            isExternal: true,
            isArchived: false,
            isValidated: true,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id
          );

          const newTitle = 'updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: opportunity.id,
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(401);
        });
      });
      describe('/join - Update a user opportunity association', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let candidate: User;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });

          candidate = await userFactory.create({ role: UserRoles.CANDIDAT });

          ({ loggedInCandidate, loggedInCoach } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
        });

        it('Should return 200, if candidate updates his opportunities asociations', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          const opportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              opportunity.id,
              loggedInCandidate.user.id,
              { seen: false }
            );

          const update = {
            ...opportunityUser,
            note: 'noteUpdate',
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.note).toBe('noteUpdate');
        });
        it('Should return 200, if a coach updates his associated candidate opportunities asociations', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          const opportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              opportunity.id,
              loggedInCandidate.user.id,
              { seen: false }
            );

          const update = {
            ...opportunityUser,
            seen: true,
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.seen).toBe(true);
        });
        it('Should return 200, if a admin updates candidate opportunities associations', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          const opportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              opportunity.id,
              loggedInCandidate.user.id,
              { bookmarked: false }
            );

          const update = {
            ...opportunityUser,
            bookmarked: true,
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.bookmarked).toBe(true);
        });
        it('Should return 400, if invalid user id', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          const opportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              opportunity.id,
              loggedInCandidate.user.id,
              { seen: false }
            );

          const update = {
            ...opportunityUser,
            UserId: '1111-invalid-99999',
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(update);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if candidate updates an other candidate opportunities asociations', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          const opportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              opportunity.id,
              candidate.id,
              { status: OfferStatuses.TO_PROCESS.value }
            );

          const update = {
            ...opportunityUser,
            status: OfferStatuses.CONTACTED.value,
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(update);
          expect(response.status).toBe(403);
        });
        it("Should return 403, if a coach updates not associate candidate's opportunities asociations", async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          const opportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              opportunity.id,
              candidate.id,
              { status: OfferStatuses.TO_PROCESS.value }
            );

          const update = {
            ...opportunityUser,
            status: OfferStatuses.CONTACTED.value,
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(update);
          expect(response.status).toBe(403);
        });
      });
    });
    describe('U - Update many Opportunities', () => {
      describe('/bulk - Bulk update opportunities', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });

          ({ loggedInCandidate, loggedInCoach } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
        });

        it('Should return 200, and updated opportunities ids, if admin bulk updates some opportunities', async () => {
          const originalOpportunities = await databaseHelper.createEntities(
            opportunityFactory,
            5,
            {
              isValidated: true,
              isPublic: true,
              isArchived: false,
              department: 'Rhône (69)',
            },
            { businessLines: ['id', 'aa'] },
            true
          );
          const originalOpportunitiesIds = originalOpportunities.map(
            ({ id }) => {
              return id;
            }
          );

          const response: APIResponse<OpportunitiesController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/bulk`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                attributes: {
                  isArchived: true,
                },
                ids: originalOpportunitiesIds,
              });

          expect(response.status).toBe(200);

          const { nbUpdated, updatedIds } = response.body;
          const updatedOffers =
            await opportunitiesHelper.findAllOpportunitiesById(
              originalOpportunitiesIds
            );

          expect(nbUpdated).toBeLessThanOrEqual(originalOpportunities.length);
          expect(originalOpportunitiesIds).toEqual(
            expect.arrayContaining(updatedIds.sort())
          );
          expect(
            updatedOffers.map((opp: Opportunity) => {
              return opp.toJSON();
            })
          ).toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                isArchived: false,
              }),
            ])
          );
        });
        it('Should return 403, if not logged in as admin', async () => {
          const originalOpportunities = await databaseHelper.createEntities(
            opportunityFactory,
            5,
            {
              isValidated: true,
              isPublic: true,
              isArchived: false,
              department: 'Rhône (69)',
            },
            { businessLines: ['id', 'aa'] },
            true
          );
          const originalOpportunitiesIds = originalOpportunities.map(
            ({ id }) => {
              return id;
            }
          );

          const response: APIResponse<OpportunitiesController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/bulk`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                attributes: {
                  isArchived: true,
                },
                ids: originalOpportunitiesIds,
              });

          expect(response.status).toBe(403);
        });
      });
    });
  });
});
