import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import moment from 'moment';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import {
  BitlyMocks,
  CacheMocks,
  QueueMocks,
  SalesforceMocks,
} from '../mocks.types';
import { LoggedUser } from 'src/auth/auth.types';
import { BitlyService } from 'src/external-services/bitly/bitly.service';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { Opportunity, OpportunityUser } from 'src/opportunities/models';
import { OpportunityUserEvent } from 'src/opportunities/models/opportunity-user-event.model';
import { OpportunitiesController } from 'src/opportunities/opportunities.controller';
import {
  OfferAdminTabs,
  OfferStatus,
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
import { OpportunityUserEventFactory } from './opportunity-user-event.factory';
import { OpportunityUsersHelper } from './opportunity-users.helper';
import { OpportunityFactory } from './opportunity.factory';

describe('Opportunities', () => {
  let app: INestApplication;

  const route = '/opportunity';

  let databaseHelper: DatabaseHelper;
  let opportunitiesHelper: OpportunitiesHelper;
  let opportunityFactory: OpportunityFactory;
  let opportunityUserEventFactory: OpportunityUserEventFactory;
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
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    opportunityFactory =
      moduleFixture.get<OpportunityFactory>(OpportunityFactory);
    opportunityUserEventFactory =
      moduleFixture.get<OpportunityUserEventFactory>(
        OpportunityUserEventFactory
      );
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
            role: UserRoles.CANDIDATE,
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
        });

        it('Should return 201, if valid opportunity', async () => {
          const opportunity = await opportunityFactory.create(
            { isPublic: true, isValidated: false },
            {},
            false
          );

          const {
            createdAt,
            updatedAt,
            createdBy,
            isValidated,
            isArchived,
            ...restOpportunity
          } = opportunity;

          const response: APIResponse<OpportunitiesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send(restOpportunity);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restOpportunity,
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
          const {
            createdAt,
            updatedAt,
            createdBy,
            isValidated,
            isArchived,
            ...restOpportunity
          } = opportunity;

          const response: APIResponse<OpportunitiesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(restOpportunity);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restOpportunity,
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
          const {
            createdAt,
            updatedAt,
            createdBy,
            isValidated,
            isArchived,
            ...restOpportunity
          } = opportunity;

          const response: APIResponse<OpportunitiesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send({ ...restOpportunity, isAdmin: true });
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

          const {
            createdAt,
            updatedAt,
            createdBy,
            isValidated,
            isArchived,
            ...restOpportunity
          } = opportunity;

          const response: APIResponse<OpportunitiesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send({
                ...restOpportunity,
                locations: [locations.paris, locations.lyon, locations.lille],
              });
          expect(response.status).toBe(201);
          expect(response.body.length).toBe(3);
          expect(response.body).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                ...restOpportunity,
                address: locations.paris.address,
                department: locations.paris.department,
                date: opportunity.date.toISOString(),
              }),
              expect.objectContaining({
                ...restOpportunity,
                address: locations.lyon.address,
                department: locations.lyon.department,
                date: opportunity.date.toISOString(),
              }),
              expect.objectContaining({
                ...restOpportunity,
                address: locations.lille.address,
                department: locations.lille.department,
                date: opportunity.date.toISOString(),
              }),
            ])
          );
        });
        it('Should return 400, if invalid opportunity', async () => {
          const opportunity = await opportunityFactory.create({}, {}, false);
          const { createdAt, updatedAt, createdBy, title, ...restOpportunity } =
            opportunity;

          const response: APIResponse<OpportunitiesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send(restOpportunity);
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
            role: UserRoles.CANDIDATE,
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
            role: UserRoles.CANDIDATE,
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
            recruiterMail: opportunity.recruiterMail,
            recruiterFirstName: opportunity.recruiterFirstName,
            recruiterName: opportunity.recruiterName,
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
            recruiterMail: opportunity.recruiterMail,
            recruiterFirstName: opportunity.recruiterFirstName,
            recruiterName: opportunity.recruiterName,
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
            recruiterMail: opportunity.recruiterMail,
            recruiterFirstName: opportunity.recruiterFirstName,
            recruiterName: opportunity.recruiterName,
          };
          const response: APIResponse<
            OpportunitiesController['createExternal']
          > = await request(app.getHttpServer())
            .post(`${route}/external`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({ candidateId, coachNotification: true, ...newOpportunity });
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
        it('Should return 201, and status be "Contacted", if logged in as candidate and valid opportunity with authorized values and without coach notification', async () => {
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
            recruiterMail: opportunity.recruiterMail,
            recruiterFirstName: opportunity.recruiterFirstName,
            recruiterName: opportunity.recruiterName,
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
            recruiterMail: opportunity.recruiterMail,
            recruiterFirstName: opportunity.recruiterFirstName,
            recruiterName: opportunity.recruiterName,
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
            recruiterMail: opportunity.recruiterMail,
            recruiterFirstName: opportunity.recruiterFirstName,
            recruiterName: opportunity.recruiterName,
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
            recruiterMail: opportunity.recruiterMail,
            recruiterFirstName: opportunity.recruiterFirstName,
            recruiterName: opportunity.recruiterName,
          };
          const response: APIResponse<
            OpportunitiesController['createExternal']
          > = await request(app.getHttpServer())
            .post(`${route}/external`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({ candidateId, coachNotification: true, ...newOpportunity });
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
            recruiterMail: opportunity.recruiterMail,
            recruiterFirstName: opportunity.recruiterFirstName,
            recruiterName: opportunity.recruiterName,
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
            recruiterMail: opportunity.recruiterMail,
            recruiterFirstName: opportunity.recruiterFirstName,
            recruiterName: opportunity.recruiterName,
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
            recruiterMail: opportunity.recruiterMail,
            recruiterFirstName: opportunity.recruiterFirstName,
            recruiterName: opportunity.recruiterName,
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
            role: UserRoles.CANDIDATE,
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
            role: UserRoles.CANDIDATE,
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
            candidateId: loggedInCandidate.user.id,
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
            candidateId: loggedInCandidate.user.id,
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
            candidateId: loggedInCandidate.user.id,
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
            candidateId: loggedInCandidate.user.id,
          };
          const response: APIResponse<
            OpportunitiesController['createOpportunityUser']
          > = await request(app.getHttpServer())
            .post(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(body);
          expect(response.status).toBe(400);
        });
        it('Should return 404, if non existing opportunity id', async () => {
          const opportunityId = uuid();
          const body = {
            opportunityId,
            candidateId: loggedInCandidate.user.id,
          };
          const response: APIResponse<
            OpportunitiesController['createOpportunityUser']
          > = await request(app.getHttpServer())
            .post(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(body);
          expect(response.status).toBe(404);
        });
        it('Should return 403, if candidate updates an other candidate', async () => {
          const opportunityId = publicOpportunity.id;
          const body = {
            opportunityId,
            candidateId: candidate,
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
            candidateId: candidate.id,
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
            candidateId: loggedInCandidate.user.id,
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
            candidateId: loggedInCandidate.user.id,
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
            candidateId: loggedInCandidate.user.id,
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
            candidateId: loggedInCandidate.user.id,
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
    describe('C - Create 1 Opportunity Event', () => {
      describe('/event - Create an opportunity event related to an opportunity user', () => {
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let loggedInAdmin: LoggedUser;
        let candidate: User;
        let otherOpportunity: Opportunity;
        let associatedOpportunity: Opportunity;
        let associatedOpportunityUser: OpportunityUser;
        let notValidatedOpportunity: Opportunity;
        let notValidatedOpportunityUser: OpportunityUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
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
            role: UserRoles.CANDIDATE,
          });

          associatedOpportunity = await opportunityFactory.create({
            isValidated: true,
          });

          associatedOpportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              associatedOpportunity.id,
              loggedInCandidate.user.id
            );

          notValidatedOpportunity = await opportunityFactory.create({
            isValidated: false,
          });

          notValidatedOpportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              notValidatedOpportunity.id,
              loggedInCandidate.user.id
            );

          otherOpportunity = await opportunityFactory.create({
            isValidated: true,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            otherOpportunity.id,
            candidate.id
          );
        });

        it('Should return 201, if candidate creates an event for one of his opportunities', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({
              opportunityId: associatedOpportunity.id,
              candidateId: loggedInCandidate.user.id,
              ...newEvent,
            });

          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...newEvent,
              OpportunityUserId: associatedOpportunityUser.id,
              startDate: newEvent.startDate.toISOString(),
              endDate: newEvent.endDate.toISOString(),
              contract: expect.objectContaining(newEvent.contract),
            })
          );
        });
        it("Should return 201, if a coach creates an event for one of his candidate's opportunities", async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({
              opportunityId: associatedOpportunity.id,
              candidateId: loggedInCandidate.user.id,
              ...newEvent,
            });

          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...newEvent,
              OpportunityUserId: associatedOpportunityUser.id,
              startDate: newEvent.startDate.toISOString(),
              endDate: newEvent.endDate.toISOString(),
              contract: expect.objectContaining(newEvent.contract),
            })
          );
        });
        it('Should return 201, if admin creates an event for a opportunity associated to a specified candidate', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({
              opportunityId: associatedOpportunity.id,
              candidateId: loggedInCandidate.user.id,
              ...newEvent,
            });

          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...newEvent,
              OpportunityUserId: associatedOpportunityUser.id,
              startDate: newEvent.startDate.toISOString(),
              endDate: newEvent.endDate.toISOString(),
              contract: expect.objectContaining(newEvent.contract),
            })
          );
        });

        it('Should return 201, if admin creates an event for not validated opportunity associated to a specified candidate', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({
              opportunityId: notValidatedOpportunity.id,
              candidateId: loggedInCandidate.user.id,
              ...newEvent,
            });

          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...newEvent,
              OpportunityUserId: notValidatedOpportunityUser.id,
              startDate: newEvent.startDate.toISOString(),
              endDate: newEvent.endDate.toISOString(),
              contract: expect.objectContaining(newEvent.contract),
            })
          );
        });
        it('Should return 403, if candidate creates event for not validated opportunity', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({
              opportunityId: notValidatedOpportunity.id,
              candidateId: loggedInCandidate.user.id,
              ...newEvent,
            });

          expect(response.status).toBe(403);
        });
        it('Should return 403, if a coach creates event for not validated opportunity', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({
              opportunityId: notValidatedOpportunity.id,
              candidateId: loggedInCandidate.user.id,
              ...newEvent,
            });

          expect(response.status).toBe(403);
        });

        it('Should return 400, if invalid opportunity id', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({
              opportunityId: '1111-invalid-99999',
              candidateId: loggedInCandidate.user.id,
              ...newEvent,
            });
          expect(response.status).toBe(400);
        });
        it('Should return 404, if not existing opportunity id', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({
              opportunityId: uuid(),
              candidateId: loggedInCandidate.user.id,
              ...newEvent,
            });
          expect(response.status).toBe(404);
        });
        it('Should return 400, if missing mandatory fields', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({
              opportunityId: associatedOpportunity.id,
              candidateId: loggedInCandidate.user.id,
              ...newEvent,
            });
          expect(response.status).toBe(400);
        });

        it('Should return 404, if candidate creates event for an opportunity not associated to him', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({
              opportunityId: otherOpportunity.id,
              candidateId: loggedInCandidate.user.id,
              ...newEvent,
            });
          expect(response.status).toBe(404);
        });
        it('Should return 404, if a coach creates event for an opportunity not associated to his candidate', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({
              opportunityId: otherOpportunity.id,
              candidateId: loggedInCandidate.user.id,
              ...newEvent,
            });
          expect(response.status).toBe(404);
        });
        it('Should return 403, if candidate creates event for an opportunity associated to another candidate', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({
              opportunityId: otherOpportunity.id,
              candidateId: candidate.id,
              ...newEvent,
            });
          expect(response.status).toBe(403);
        });
        it('Should return 403, if coach creates event for an opportunity associated to another candidate', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({
              opportunityId: otherOpportunity.id,
              candidateId: candidate.id,
              ...newEvent,
            });
          expect(response.status).toBe(403);
        });
        it('Should return 404, if an admin creates event for an opportunity not associated to the specified candidate', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const newEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdi' },
          };

          const response: APIResponse<
            OpportunitiesController['createOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .post(`${route}/event`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({
              opportunityId: otherOpportunity.id,
              candidateId: loggedInCandidate.user.id,
              ...newEvent,
            });
          expect(response.status).toBe(404);
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
        let privateOpportunityUser: OpportunityUser;
        let privateOpportunityUserEvent: OpportunityUserEvent;
        let publicOpportunity: Opportunity;
        let notValidatedOpportunity: Opportunity;
        let notValidatedOpportunityUser: OpportunityUser;
        let otherPrivateOpportunity: Opportunity;
        let otherPrivateOpportunityUser: OpportunityUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
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
            role: UserRoles.CANDIDATE,
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

          privateOpportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              privateOpportunity.id,
              loggedInCandidate.user.id
            );

          privateOpportunityUserEvent =
            await opportunityUserEventFactory.create(
              { OpportunityUserId: privateOpportunityUser.id },
              { contract: 'cdi' }
            );

          notValidatedOpportunity = await opportunityFactory.create({
            isValidated: false,
            isArchived: false,
            isPublic: false,
            isExternal: false,
          });

          notValidatedOpportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              notValidatedOpportunity.id,
              loggedInCandidate.user.id
            );

          await opportunityUserEventFactory.create(
            { OpportunityUserId: notValidatedOpportunityUser.id },
            { contract: 'cdi' }
          );

          otherPrivateOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
            isPublic: false,
          });

          otherPrivateOpportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              otherPrivateOpportunity.id,
              candidate.id
            );

          await opportunityUserEventFactory.create(
            { OpportunityUserId: otherPrivateOpportunityUser.id },
            { contract: 'cdi' }
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
            recruiterPhone,
            ...restPrivateOpportunity
          } = privateOpportunity;

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restPrivateOpportunity,
              opportunityUsers: expect.objectContaining({
                ...privateOpportunityUser,
                createdAt: privateOpportunityUser.createdAt.toISOString(),
                updatedAt: privateOpportunityUser.updatedAt.toISOString(),
                events: expect.arrayContaining([
                  expect.objectContaining({
                    ...privateOpportunityUserEvent,
                    startDate:
                      privateOpportunityUserEvent.startDate.toISOString(),
                    endDate: privateOpportunityUserEvent.endDate.toISOString(),
                    createdAt:
                      privateOpportunityUserEvent.createdAt.toISOString(),
                    updatedAt:
                      privateOpportunityUserEvent.updatedAt.toISOString(),
                    contract: expect.objectContaining({
                      ...privateOpportunityUserEvent.contract,
                      createdAt:
                        privateOpportunityUserEvent.contract.createdAt.toISOString(),
                      updatedAt:
                        privateOpportunityUserEvent.contract.updatedAt.toISOString(),
                    }),
                  }),
                ]),
              }),

              createdAt: restPrivateOpportunity.createdAt.toISOString(),
              updatedAt: restPrivateOpportunity.updatedAt.toISOString(),
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
            recruiterPhone,
            ...restPrivateOpportunity
          } = privateOpportunity;

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restPrivateOpportunity,
              opportunityUsers: [
                expect.objectContaining({
                  ...privateOpportunityUser,
                  createdAt: privateOpportunityUser.createdAt.toISOString(),
                  updatedAt: privateOpportunityUser.updatedAt.toISOString(),
                  events: expect.arrayContaining([
                    expect.objectContaining({
                      ...privateOpportunityUserEvent,
                      startDate:
                        privateOpportunityUserEvent.startDate.toISOString(),
                      endDate:
                        privateOpportunityUserEvent.endDate.toISOString(),
                      createdAt:
                        privateOpportunityUserEvent.createdAt.toISOString(),
                      updatedAt:
                        privateOpportunityUserEvent.updatedAt.toISOString(),
                      contract: expect.objectContaining({
                        ...privateOpportunityUserEvent.contract,
                        createdAt:
                          privateOpportunityUserEvent.contract.createdAt.toISOString(),
                        updatedAt:
                          privateOpportunityUserEvent.contract.updatedAt.toISOString(),
                      }),
                    }),
                  ]),
                }),
              ],
              createdAt: restPrivateOpportunity.createdAt.toISOString(),
              updatedAt: restPrivateOpportunity.updatedAt.toISOString(),
              date: restPrivateOpportunity.date.toISOString(),
            })
          );
        });
        it('Should return 200, if admin reads a private opportunity', async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${privateOpportunity.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);

          const { revision, deletedAt, ...restPrivateOpportunityUser } =
            privateOpportunityUser;

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...privateOpportunity,
              opportunityUsers: [
                expect.objectContaining({
                  ...restPrivateOpportunityUser,
                  createdAt: restPrivateOpportunityUser.createdAt.toISOString(),
                  updatedAt: restPrivateOpportunityUser.updatedAt.toISOString(),
                  events: expect.arrayContaining([
                    expect.objectContaining({
                      ...privateOpportunityUserEvent,
                      startDate:
                        privateOpportunityUserEvent.startDate.toISOString(),
                      endDate:
                        privateOpportunityUserEvent.endDate.toISOString(),
                      createdAt:
                        privateOpportunityUserEvent.createdAt.toISOString(),
                      updatedAt:
                        privateOpportunityUserEvent.updatedAt.toISOString(),
                      contract: expect.objectContaining({
                        ...privateOpportunityUserEvent.contract,
                        createdAt:
                          privateOpportunityUserEvent.contract.createdAt.toISOString(),
                        updatedAt:
                          privateOpportunityUserEvent.contract.updatedAt.toISOString(),
                      }),
                    }),
                  ]),
                }),
              ],
              createdAt: privateOpportunity.createdAt.toISOString(),
              updatedAt: privateOpportunity.updatedAt.toISOString(),
              date: privateOpportunity.date.toISOString(),
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
            recruiterPhone,
            opportunityUsers,
            ...responsePublicOpportunity
          } = publicOpportunity;

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...responsePublicOpportunity,
              createdAt: responsePublicOpportunity.createdAt.toISOString(),
              updatedAt: responsePublicOpportunity.updatedAt.toISOString(),
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
            recruiterPhone,
            opportunityUsers,
            ...responsePublicOpportunity
          } = publicOpportunity;

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...responsePublicOpportunity,
              createdAt: responsePublicOpportunity.createdAt.toISOString(),
              updatedAt: responsePublicOpportunity.updatedAt.toISOString(),
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
              createdAt: publicOpportunity.createdAt.toISOString(),
              updatedAt: publicOpportunity.updatedAt.toISOString(),
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
        it('Should return 404, if candidate reads an opportunity associated to him but not validated and not external', async () => {
          const response: APIResponse<OpportunitiesController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${notValidatedOpportunity.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(404);
        });
        it('Should return 404, if coach reads an opportunity associated to his candidate but not validated and not external', async () => {
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
            role: UserRoles.CANDIDATE,
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
        it('Should return 200 and 2 first opportunities', async () => {
          const firstOpportunity = await opportunityFactory.create({});

          const secondpportunity = await opportunityFactory.create({});

          await opportunityFactory.create({});

          await opportunityFactory.create({});

          const expectedOpportunitiesId = [
            firstOpportunity.id,
            secondpportunity.id,
          ];

          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/admin?limit=2&offset=0`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200 and third and fourth opportunities', async () => {
          
          await opportunityFactory.create({});
          
          await opportunityFactory.create({});
          
          const thirdOpportunity = await opportunityFactory.create({});

          const fourthpportunity = await opportunityFactory.create({});
          
          const expectedOpportunitiesId = [
            thirdOpportunity.id,
            fourthpportunity.id,
          ];


          const response: APIResponse<OpportunitiesController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/admin?limit=2&offset=1`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
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
            role: UserRoles.CANDIDATE,
          });
          const firstOpportunity = await opportunityFactory.create({});
          await opportunityUsersHelper.associateOpportunityUser(
            firstOpportunity.id,
            newUser1.id,
            { status: OfferStatuses.INTERVIEW.value }
          );

          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          const secondOpportunity = await opportunityFactory.create({});
          await opportunityUsersHelper.associateOpportunityUser(
            secondOpportunity.id,
            newUser2.id,
            { status: OfferStatuses.HIRED.value }
          );

          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDATE,
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
            role: UserRoles.CANDIDATE,
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
      describe("/candidate/private/:candidateId?search=&type=&businessLines[]=&status[]=&isPublic[]&department[]= - Read a user's private opportunities as admin", () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
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
            .get(`${route}/candidate/private/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if a coach reads his associated candidate opportunities', async () => {
          const response: APIResponse<
            OpportunitiesController['findAllUserOpportunitiesAsAdmin']
          > = await request(app.getHttpServer())
            .get(`${route}/candidate/private/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 400, if invalid user id', async () => {
          const response: APIResponse<
            OpportunitiesController['findAllUserOpportunitiesAsAdmin']
          > = await request(app.getHttpServer())
            .get(`${route}/candidate/private/1111-invalid-99999`)
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
            .get(`${route}/candidate/private/${loggedInCandidate.user.id}`)
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
              `${route}/candidate/private/${loggedInCandidate.user.id}?isPublic[]=true`
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
              `${route}/candidate/private/${loggedInCandidate.user.id}?department[]=Rhône (69)&department[]=Nord (59)`
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
              `${route}/candidate/private/${loggedInCandidate.user.id}?status[]=1&status[]=2`
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
              `${route}/candidate/private/${loggedInCandidate.user.id}?businessLines[]=id&businessLines[]=bat`
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
              `${route}/candidate/private/${loggedInCandidate.user.id}?search=XXXXX`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(1);
          expect(expectedOpportunitiesId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
      });
      describe("/candidate/all/:candidateId - Read all user's opportunities", () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let candidate: User;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          candidate = await userFactory.create({ role: UserRoles.CANDIDATE });

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
            .get(`${route}/candidate/all/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 400, if invalid user id', async () => {
          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/candidate/all/1111-invalid-99999`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if candidate reads an other candidate opportunities', async () => {
          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/candidate/all/${candidate.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it("Should return 403, if a coach reads not associate candidate's opportunities", async () => {
          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/candidate/all/${candidate.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 400, if candidate reads his opportunities without filters', async () => {
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

          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/candidate/all/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(400);
        });
        it('Should return 400, if a coach reads his associated candidate opportunities without filters', async () => {
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

          const response: APIResponse<
            OpportunitiesController['findAllAsCandidate']
          > = await request(app.getHttpServer())
            .get(`${route}/candidate/all/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(400);
        });

        describe("/candidate/all/:candidateId?search=&type=&businessLines[]=&status[]=&department[]=&contracts[]= - Read all user's opportunities", () => {
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

            // Non validated opportunity
            await opportunityFactory.create({
              isPublic: true,
              isArchived: true,
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
              .get(
                `${route}/candidate/all/${loggedInCandidate.user.id}?type=public`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(2);
            expect(expectedOpportunitiesId).toEqual(
              expect.arrayContaining(response.body.offers.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the opportunities that matches the status filter', async () => {
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
              [firstOpportunity.id, secondOpportunity.id],
              loggedInCandidate.user.id,
              { archived: false, status: -1 }
            );

            await opportunityUsersHelper.associateOpportunityUser(
              thirdOpportunity.id,
              loggedInCandidate.user.id,
              { archived: false, status: 0 }
            );

            const expectedOpportunitiesId = [
              firstOpportunity.id,
              secondOpportunity.id,
            ];

            const response: APIResponse<
              OpportunitiesController['findAllAsCandidate']
            > = await request(app.getHttpServer())
              .get(
                `${route}/candidate/all/${loggedInCandidate.user.id}?type=public&status[]=-1`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(2);
            expect(expectedOpportunitiesId).toEqual(
              expect.arrayContaining(response.body.offers.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the public opportunities that matches the department filters', async () => {
            const firstOpportunity = await opportunityFactory.create({
              department: 'Rhône (69)',
              isPublic: true,
              isArchived: false,
              isValidated: true,
            });

            const secondOpportunity = await opportunityFactory.create({
              department: 'Rhône (69)',
              isPublic: true,
              isArchived: false,
              isValidated: true,
            });

            const thirdOpportunity = await opportunityFactory.create({
              department: 'Nord (59)',
              isPublic: true,
              isArchived: false,
              isValidated: true,
            });

            const fourthOpportunity = await opportunityFactory.create({
              department: 'Paris (75)',
              isPublic: true,
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
                `${route}/candidate/all/${loggedInCandidate.user.id}?department[]=Rhône (69)&department[]=Nord (59)&type=public`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(3);
            expect(expectedOpportunitiesId).toEqual(
              expect.arrayContaining(response.body.offers.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the public opportunities that matches the businessLines filters', async () => {
            const firstOpportunity = await opportunityFactory.create(
              { isArchived: false, isValidated: true, isPublic: true },
              { businessLines: ['id', 'bat'] }
            );

            const secondOpportunity = await opportunityFactory.create(
              { isArchived: false, isValidated: true, isPublic: true },
              { businessLines: ['bat'] }
            );

            const thirdOpportunity = await opportunityFactory.create(
              { isArchived: false, isValidated: true, isPublic: true },
              { businessLines: ['id'] }
            );

            const fourthOpportunity = await opportunityFactory.create(
              { isArchived: false, isValidated: true, isPublic: true },
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
                `${route}/candidate/all/${loggedInCandidate.user.id}?businessLines[]=id&businessLines[]=bat&type=public`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(3);
            expect(expectedOpportunitiesId).toEqual(
              expect.arrayContaining(response.body.offers.map(({ id }) => id))
            );
          });
          /*
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
                `${route}/candidate/all/${loggedInCandidate.user.id}?department[]=Rhône (69)&type=private`
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
          */
          it('Should return 200, and all the opportunities that matches the contracts filters', async () => {
            const firstOpportunity = await opportunityFactory.create({
              isArchived: false,
              isValidated: true,
              isPublic: true,
              contract: 'cdi',
            });
            await opportunityUsersHelper.associateOpportunityUser(
              firstOpportunity.id,
              loggedInCandidate.user.id,
              { archived: false }
            );

            const secondOpportunity = await opportunityFactory.create({
              isArchived: false,
              isValidated: true,
              isPublic: true,
              contract: 'cdd',
            });
            await opportunityUsersHelper.associateOpportunityUser(
              secondOpportunity.id,
              loggedInCandidate.user.id,
              { archived: false }
            );

            const thirdOpportunity = await opportunityFactory.create({
              isArchived: false,
              isValidated: true,
              isPublic: true,
              contract: 'cdi',
            });
            await opportunityUsersHelper.associateOpportunityUser(
              thirdOpportunity.id,
              loggedInCandidate.user.id,
              { archived: false }
            );

            const expectedOpportunitiesId = [
              firstOpportunity.id,
              thirdOpportunity.id,
            ];

            const response: APIResponse<
              OpportunitiesController['findAllAsCandidate']
            > = await request(app.getHttpServer())
              .get(
                `${route}/candidate/all/${loggedInCandidate.user.id}?contracts[]=cdi&type=public`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(2);
            expect(expectedOpportunitiesId).toEqual(
              expect.arrayContaining(response.body.offers.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the public opportunities that matches the search query', async () => {
            const searchedOpportunity = await opportunityFactory.create({
              title: 'XXXXX',
              isArchived: false,
              isValidated: true,
              isPublic: true,
            });

            await opportunityFactory.create({
              title: 'AZERTY',
              isArchived: false,
              isValidated: true,
              isPublic: true,
            });

            await opportunityFactory.create({
              title: 'AZERTY',
              isArchived: false,
              isValidated: true,
              isPublic: true,
            });

            const expectedOpportunitiesId = [searchedOpportunity.id];

            const response: APIResponse<
              OpportunitiesController['findAllAsCandidate']
            > = await request(app.getHttpServer())
              .get(
                `${route}/candidate/all/${loggedInCandidate.user.id}?search=XXXXX&type=public`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(1);
            expect(expectedOpportunitiesId).toEqual(
              expect.arrayContaining(response.body.offers.map(({ id }) => id))
            );
          });
        });
        describe('/candidate/all/:candidateId?limit=&offset= - Get paginated opportunities and sorted by date', () => {
          beforeEach(async () => {
            const firstOpportunity = await opportunityFactory.create({
              isArchived: false,
              isValidated: true,
              isPublic: true,
              title: 'D',
              date: moment('2022-12-01', 'YYYY-MM-DD').toDate(),
            });

            const secondOpportunity = await opportunityFactory.create({
              isArchived: false,
              isValidated: true,
              isPublic: true,
              title: 'C',
              date: moment('2022-12-02', 'YYYY-MM-DD').toDate(),
            });

            const thirdOpportunity = await opportunityFactory.create({
              isArchived: false,
              isValidated: true,
              isPublic: true,
              title: 'B',
              date: moment('2022-12-03', 'YYYY-MM-DD').toDate(),
            });

            const fourthOpportunity = await opportunityFactory.create({
              isArchived: false,
              isValidated: true,
              isPublic: true,
              title: 'A',
              date: moment('2022-12-04', 'YYYY-MM-DD').toDate(),
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
          });

          it('Should return 200 and 2 first opportunities', async () => {
            const response: APIResponse<
              OpportunitiesController['findAllAsCandidate']
            > = await request(app.getHttpServer())
              .get(
                `${route}/candidate/all/${loggedInCandidate.user.id}?limit=2&offset=0&type=public`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(2);
            expect(response.body.offers[0].title).toMatch('A');
            expect(response.body.offers[1].title).toMatch('B');
          });
          it('Should return 200 and the 3rd and 4th opportunity', async () => {
            const response: APIResponse<
              OpportunitiesController['findAllAsCandidate']
            > = await request(app.getHttpServer())
              .get(
                `${route}/candidate/all/${loggedInCandidate.user.id}?limit=2&offset=1&type=public`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(2);
            expect(response.body.offers[0].title).toMatch('C');
            expect(response.body.offers[1].title).toMatch('D');
          });
        });
      });
      describe("/candidate/tabCount/:candidateId - Get candidate's opportunities count for each status", () => {
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let loggedInAdmin: LoggedUser;
        let candidate: User;
        beforeEach(async () => {
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          candidate = await userFactory.create({ role: UserRoles.CANDIDATE });

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
            7,
            {
              isArchived: false,
              isValidated: true,
              department: 'Rhône (69)',
            }
          );
          await Promise.all(
            opportunities.map((opp, i) => {
              let status;
              let archived = false;
              if (i < 6) {
                status = i - 1;
              } else {
                status = -1;
                archived = true;
              }
              return opportunityUsersHelper.associateOpportunityUser(
                opp.id,
                loggedInCandidate.user.id,
                { status: status as OfferStatus, archived, bookmarked: true }
              );
            })
          );
        });

        it('Should return 200, with the correct array if candidate counts his opportunities according to status', async () => {
          const response: APIResponse<
            OpportunitiesController['candidateCountOffersByStatus']
          > = await request(app.getHttpServer())
            .get(`${route}/candidate/tabCount/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(7);
        });
        it("Should return 200, if a coach counts his associated candidate's opportunities according to status", async () => {
          const response: APIResponse<
            OpportunitiesController['candidateCountOffersByStatus']
          > = await request(app.getHttpServer())
            .get(`${route}/candidate/tabCount/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(7);
        });
        it("Should return 403, if a admin counts a candidate's opportunities according to status", async () => {
          const response: APIResponse<
            OpportunitiesController['candidateCountOffersByStatus']
          > = await request(app.getHttpServer())
            .get(`${route}/candidate/tabCount/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it("Should return 403, if candidate counts an other candidate's opportunities according to status", async () => {
          const response: APIResponse<
            OpportunitiesController['candidateCountOffersByStatus']
          > = await request(app.getHttpServer())
            .get(`${route}/candidate/tabCount/${candidate.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
      });
      describe("/candidate/count/:id - Count all new candidate's opportunities", () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let candidate: User;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          candidate = await userFactory.create({ role: UserRoles.CANDIDATE });

          ({ loggedInCandidate, loggedInCoach } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));

          await cvFactory.create({ UserId: loggedInCandidate.user.id });

          const opportunities = await databaseHelper.createEntities(
            opportunityFactory,
            3,
            {
              isArchived: false,
              isValidated: true,
              isPublic: true,
            }
          );

          const otherOpportunities = await databaseHelper.createEntities(
            opportunityFactory,
            3,
            {
              isArchived: false,
              isValidated: true,
              isPublic: false,
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

        it('Should return 200, if candidate counts his unseen private opportunities', async () => {
          const response: APIResponse<OpportunitiesController['countUnseen']> =
            await request(app.getHttpServer())
              .get(`${route}/candidate/count/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.unseenOpportunities).toBe(3);
        });
        it("Should return 200, if a coach counts his associated candidate's unseen opportunities", async () => {
          const response: APIResponse<OpportunitiesController['countUnseen']> =
            await request(app.getHttpServer())
              .get(`${route}/candidate/count/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.unseenOpportunities).toBe(3);
        });
        it("Should return 403, if a admin counts a candidate's unseen opportunities", async () => {
          const response: APIResponse<OpportunitiesController['countUnseen']> =
            await request(app.getHttpServer())
              .get(`${route}/candidate/count/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it("Should return 403, if candidate counts an other candidate's unseen opportunities", async () => {
          const response: APIResponse<OpportunitiesController['countUnseen']> =
            await request(app.getHttpServer())
              .get(`${route}/candidate/count/${candidate.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
      });
    });
    describe('U - Update 1 Opportunity', () => {
      describe('/:id - Update an opportunity', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let opportunity: Opportunity;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });

          opportunity = await opportunityFactory.create({});
        });

        it('Should return 200, if admin updates an opportunity', async () => {
          const update = {
            title: 'updated title',
          };
          const response: APIResponse<OpportunitiesController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/${opportunity.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(update);
          expect(response.status).toBe(200);
          expect(response.body.title).toBe('updated title');
        });

        it('Should return 200, if admin adds a user to a public opportunity', async () => {
          const update = {
            candidatesIds: [loggedInCandidate.user.id],
          };
          const response: APIResponse<OpportunitiesController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/${opportunity.id}`)
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
              .put(`${route}/${opportunity.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send(update);
          expect(response.status).toBe(403);
        });
      });
      describe('/external/:id/:candidateId - Update an external opportunity', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let candidate: User;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });

          candidate = await userFactory.create({ role: UserRoles.CANDIDATE });

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
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(updatedOpportunity);
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
            .put(`${route}/external/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(updatedOpportunity);
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
            .put(`${route}/external/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(updatedOpportunity);
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
            title: newTitle,
          };
          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(updatedOpportunity);
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
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(updatedOpportunity);
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
            .put(`${route}/external/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(updatedOpportunity);
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
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(updatedOpportunity);
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
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(updatedOpportunity);
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
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(updatedOpportunity);
          expect(response.status).toBe(404);
        });
        it('Should return 404, if logged in as admin and updates opportunity without candidateId', async () => {
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
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external/${opportunity.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(updatedOpportunity);
          expect(response.status).toBe(404);
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
            title: newTitle,
          };

          const response: APIResponse<
            OpportunitiesController['updateExternal']
          > = await request(app.getHttpServer())
            .put(`${route}/external/${opportunity.id}/${candidateId}`)
            .send(updatedOpportunity);
          expect(response.status).toBe(401);
        });
      });
      describe('/join/:opportunityId/:candidateId - Update a user opportunity association', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let candidate: User;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });

          candidate = await userFactory.create({ role: UserRoles.CANDIDATE });

          ({ loggedInCandidate, loggedInCoach } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
        });

        it('Should return 200, if candidate updates his opportunity association', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id,
            { seen: false }
          );

          const candidateId = loggedInCandidate.user.id;

          const update = {
            note: 'noteUpdate',
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.note).toBe('noteUpdate');
        });

        it('Should return 200, if candidate updates his opportunity association', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id,
            { seen: false }
          );

          const candidateId = loggedInCandidate.user.id;

          const update = {
            note: 'noteUpdate',
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.note).toBe('noteUpdate');
        });
        it('Should return 200, if a coach updates his associated candidate oppotunity asociation', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id,
            { seen: false }
          );

          const candidateId = loggedInCandidate.user.id;

          const update = {
            seen: true,
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.seen).toBe(true);
        });
        it('Should return 200, if a admin updates candidate opportunitiy association', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id,
            { bookmarked: false }
          );

          const candidateId = loggedInCandidate.user.id;

          const update = {
            bookmarked: true,
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.bookmarked).toBe(true);
        });
        it('Should return 200, if a admin updates candidate validated opportunity association', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id,
            { bookmarked: false }
          );

          const candidateId = loggedInCandidate.user.id;

          const update = {
            bookmarked: true,
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.bookmarked).toBe(true);
        });
        it('Should return 200, if a admin updates candidate not validated opportunity association', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: false,
            isArchived: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id,
            { bookmarked: false }
          );

          const candidateId = loggedInCandidate.user.id;

          const update = {
            bookmarked: true,
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.bookmarked).toBe(true);
        });
        it('Should return 403, if candidate updates his opportunity association on a non validated opportunity', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: false,
            isArchived: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id,
            { seen: false }
          );

          const candidateId = loggedInCandidate.user.id;

          const update = {
            note: 'noteUpdate',
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(update);
          expect(response.status).toBe(403);
        });
        it("Should return 403, if a coach updates  his candidate's association on a non validated opportunity", async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: false,
            isArchived: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id,
            { seen: false }
          );

          const candidateId = loggedInCandidate.user.id;

          const update = {
            seen: true,
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(update);
          expect(response.status).toBe(403);
        });
        it('Should return 400, if invalid user id', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id,
            { seen: false }
          );

          const candidateId = '1111-invalid-99999';

          const update = {
            title: 'new title',
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(update);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if candidate updates an other candidate opportunities associations', async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            candidate.id,
            { status: OfferStatuses.TO_PROCESS.value }
          );

          const candidateId = candidate.id;

          const update = {
            status: OfferStatuses.CONTACTED.value,
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(update);
          expect(response.status).toBe(403);
        });
        it("Should return 403, if a coach updates not associate candidate's opportunities asociations", async () => {
          const opportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            candidate.id,
            { status: OfferStatuses.TO_PROCESS.value }
          );

          const candidateId = candidate.id;

          const update = {
            status: OfferStatuses.CONTACTED.value,
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUser']
          > = await request(app.getHttpServer())
            .put(`${route}/join/${opportunity.id}/${candidateId}`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(update);
          expect(response.status).toBe(403);
        });
      });
    });
    describe('P - Post Contact Employer', () => {
      describe('/contactEmployer — Contact Employer', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let opportunity: Opportunity;
        let otherOpportunity: Opportunity;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });

          opportunity = await opportunityFactory.create({
            isValidated: true,
            isExternal: false,
          });

          otherOpportunity = await opportunityFactory.create({
            isValidated: true,
            isExternal: false,
          });

          ({ loggedInCandidate, loggedInCoach } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));

          await opportunityUsersHelper.associateOpportunityUser(
            opportunity.id,
            loggedInCandidate.user.id
          );
        });

        it('Should return 201 if candidates uses the route with description', async () => {
          const response: APIResponse<
            OpportunitiesController['contactEmployer']
          > = await request(app.getHttpServer())
            .post(`${route}/contactEmployer`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({
              candidateId: loggedInCandidate.user.id,
              opportunityId: opportunity.id,
              type: 'relance',
              description: 'blabla',
            });
          expect(response.status).toBe(201);
        });
        it('Should return 201 if candidates uses the route without description', async () => {
          const response: APIResponse<
            OpportunitiesController['contactEmployer']
          > = await request(app.getHttpServer())
            .post(`${route}/contactEmployer`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({
              candidateId: loggedInCandidate.user.id,
              opportunityId: opportunity.id,
              type: 'relance',
            });
          expect(response.status).toBe(201);
        });
        it('Should return 201 if coach uses the route', async () => {
          const response: APIResponse<
            OpportunitiesController['contactEmployer']
          > = await request(app.getHttpServer())
            .post(`${route}/contactEmployer`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({
              candidateId: loggedInCandidate.user.id,
              opportunityId: opportunity.id,
              type: 'relance',
              description: '',
            });
          expect(response.status).toBe(201);
        });
        it('Should return 403 if admin uses the route', async () => {
          const response: APIResponse<
            OpportunitiesController['contactEmployer']
          > = await request(app.getHttpServer())
            .post(`${route}/contactEmployer`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({
              candidateId: loggedInCandidate.user.id,
              opportunityId: opportunity.id,
              type: 'relance',
              description: '',
            });
          expect(response.status).toBe(403);
        });
        it('Should return 403 if candidates is not associated to the opportunity', async () => {
          const response: APIResponse<
            OpportunitiesController['contactEmployer']
          > = await request(app.getHttpServer())
            .post(`${route}/contactEmployer`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({
              candidateId: loggedInCandidate.user.id,
              opportunityId: otherOpportunity.id,
              type: 'relance',
            });
          expect(response.status).toBe(403);
        });
        it("Should return 403 if coach's candidate is not associated to the opportunity", async () => {
          const response: APIResponse<
            OpportunitiesController['contactEmployer']
          > = await request(app.getHttpServer())
            .post(`${route}/contactEmployer`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({
              candidateId: loggedInCandidate.user.id,
              opportunityId: otherOpportunity.id,
              type: 'relance',
            });
          expect(response.status).toBe(403);
        });

        it("Should return 403 if coach's candidate is not associated to the opportunity", async () => {
          const response: APIResponse<
            OpportunitiesController['contactEmployer']
          > = await request(app.getHttpServer())
            .post(`${route}/contactEmployer`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({
              candidateId: loggedInCandidate.user.id,
              opportunityId: otherOpportunity.id,
              type: 'relance',
            });
          expect(response.status).toBe(403);
        });

        it('Should return 403 if candidate contacts recruiter of external opportunity', async () => {
          const externalOpportunity = await opportunityFactory.create({
            isValidated: true,
            isExternal: true,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            externalOpportunity.id,
            loggedInCandidate.user.id
          );

          const response: APIResponse<
            OpportunitiesController['contactEmployer']
          > = await request(app.getHttpServer())
            .post(`${route}/contactEmployer`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({
              candidateId: loggedInCandidate.user.id,
              opportunityId: externalOpportunity.id,
              type: 'relance',
            });
          expect(response.status).toBe(403);
        });

        it('Should return 403 if candidate contacts recruiter of not validated opportunity', async () => {
          const notValidatedOpportunity = await opportunityFactory.create({
            isValidated: false,
            isExternal: false,
          });

          await opportunityUsersHelper.associateOpportunityUser(
            notValidatedOpportunity.id,
            loggedInCandidate.user.id
          );

          const response: APIResponse<
            OpportunitiesController['contactEmployer']
          > = await request(app.getHttpServer())
            .post(`${route}/contactEmployer`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({
              candidateId: loggedInCandidate.user.id,
              opportunityId: notValidatedOpportunity.id,
              type: 'relance',
            });
          expect(response.status).toBe(403);
        });

        it('Should return 404 if opportunity doesnt exist', async () => {
          const response: APIResponse<
            OpportunitiesController['contactEmployer']
          > = await request(app.getHttpServer())
            .post(`${route}/contactEmployer`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({
              candidateId: loggedInCandidate.user.id,
              opportunityId: uuid(),
              type: 'relance',
            });
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
            role: UserRoles.CANDIDATE,
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
    describe('U - Update 1 Opportunity Event', () => {
      describe('/event/:id - Update an opportunity event', () => {
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let loggedInAdmin: LoggedUser;
        let candidate: User;
        let associatedOpportunity: Opportunity;
        let associatedOpportunityUser: OpportunityUser;
        let associatedOpportunityUserEvent: OpportunityUserEvent;
        let notValidatedOpportunity: Opportunity;
        let notValidatedOpportunityUser: OpportunityUser;
        let notValidatedOpportunityUserEvent: OpportunityUserEvent;
        let otherAssociatedOpportunity: Opportunity;
        let otherAssociatedOpportunityUser: OpportunityUser;
        let otherAssociatedOpportunityUserEvent: OpportunityUserEvent;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
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
            role: UserRoles.CANDIDATE,
          });

          associatedOpportunity = await opportunityFactory.create({
            isValidated: true,
            isArchived: false,
            isPublic: false,
          });

          associatedOpportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              associatedOpportunity.id,
              loggedInCandidate.user.id
            );

          associatedOpportunityUserEvent =
            await opportunityUserEventFactory.create(
              { OpportunityUserId: associatedOpportunityUser.id },
              { contract: 'cdi' }
            );

          notValidatedOpportunity = await opportunityFactory.create({
            isValidated: false,
            isArchived: false,
            isPublic: false,
            isExternal: false,
          });

          notValidatedOpportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              notValidatedOpportunity.id,
              loggedInCandidate.user.id
            );

          notValidatedOpportunityUserEvent =
            await opportunityUserEventFactory.create(
              { OpportunityUserId: notValidatedOpportunityUser.id },
              { contract: 'cdi' }
            );

          otherAssociatedOpportunity = await opportunityFactory.create({
            isArchived: false,
            isValidated: true,
            isPublic: false,
          });

          otherAssociatedOpportunityUser =
            await opportunityUsersHelper.associateOpportunityUser(
              otherAssociatedOpportunity.id,
              candidate.id
            );

          otherAssociatedOpportunityUserEvent =
            await opportunityUserEventFactory.create(
              { OpportunityUserId: otherAssociatedOpportunityUser.id },
              { contract: 'cdi' }
            );
        });

        it('Should return 200, if candidate updates an event for one of his opportunities', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const updatedEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdd' },
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .put(`${route}/event/${associatedOpportunityUserEvent.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(updatedEvent);

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...updatedEvent,
              OpportunityUserId: associatedOpportunityUser.id,
              startDate: updatedEvent.startDate.toISOString(),
              endDate: updatedEvent.endDate.toISOString(),
              contract: expect.objectContaining(updatedEvent.contract),
            })
          );
        });
        it("Should return 200, if a coach updates an event for one of his candidate's opportunities", async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const updatedEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdd' },
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .put(`${route}/event/${associatedOpportunityUserEvent.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(updatedEvent);

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...updatedEvent,
              OpportunityUserId: associatedOpportunityUser.id,
              startDate: updatedEvent.startDate.toISOString(),
              endDate: updatedEvent.endDate.toISOString(),
              contract: expect.objectContaining(updatedEvent.contract),
            })
          );
        });
        it('Should return 200, if admin updates an event for a opportunity associated to a specified candidate', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const updatedEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdd' },
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .put(`${route}/event/${associatedOpportunityUserEvent.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(updatedEvent);

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...updatedEvent,
              OpportunityUserId: associatedOpportunityUser.id,
              startDate: updatedEvent.startDate.toISOString(),
              endDate: updatedEvent.endDate.toISOString(),
              contract: expect.objectContaining(updatedEvent.contract),
            })
          );
        });

        it('Should return 200, if admin updates an event for not validated opportunity associated to a specified candidate', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const updatedEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdd' },
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .put(`${route}/event/${notValidatedOpportunityUserEvent.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(updatedEvent);

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...updatedEvent,
              OpportunityUserId: notValidatedOpportunityUser.id,
              startDate: updatedEvent.startDate.toISOString(),
              endDate: updatedEvent.endDate.toISOString(),
              contract: expect.objectContaining(updatedEvent.contract),
            })
          );
        });
        it('Should return 403, if candidate updates event for not validated opportunity', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const updatedEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdd' },
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .put(`${route}/event/${notValidatedOpportunityUserEvent.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(updatedEvent);

          expect(response.status).toBe(403);
        });
        it('Should return 403, if a coach updates event for not validated opportunity', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const updatedEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdd' },
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .put(`${route}/event/${notValidatedOpportunityUserEvent.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(updatedEvent);

          expect(response.status).toBe(403);
        });

        it('Should return 400, if invalid opportunity user event id', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const updatedEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdd' },
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .put(`${route}/event/1111-invalid-99999`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(updatedEvent);
          expect(response.status).toBe(400);
        });
        it('Should return 404, if not existing opportunity user event id', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const updatedEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdd' },
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .put(`${route}/event/${uuid()}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(updatedEvent);

          expect(response.status).toBe(404);
        });

        it('Should return 200, if an admin updates event for an opportunity not associated to the specified candidate', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const updatedEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdd' },
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .put(`${route}/event/${otherAssociatedOpportunityUserEvent.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(updatedEvent);

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...updatedEvent,
              OpportunityUserId: otherAssociatedOpportunityUser.id,
              startDate: updatedEvent.startDate.toISOString(),
              endDate: updatedEvent.endDate.toISOString(),
              contract: expect.objectContaining(updatedEvent.contract),
            })
          );
        });
        it('Should return 403, if candidate updates event associated to an opportunity associated to another candidate', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const updatedEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdd' },
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .put(`${route}/event/${otherAssociatedOpportunityUserEvent.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(updatedEvent);

          expect(response.status).toBe(403);
        });
        it('Should return 403, if coach updates event associated to an opportunity associated to another candidate', async () => {
          const opportunityUserEvent = await opportunityUserEventFactory.create(
            {},
            {},
            false
          );

          const updatedEvent = {
            startDate: opportunityUserEvent.startDate,
            endDate: opportunityUserEvent.endDate,
            type: opportunityUserEvent.type,
            contract: { name: 'cdd' },
          };

          const response: APIResponse<
            OpportunitiesController['updateOpportunityUserEvent']
          > = await request(app.getHttpServer())
            .put(`${route}/event/${otherAssociatedOpportunityUserEvent.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(updatedEvent);

          expect(response.status).toBe(403);
        });
      });
    });
    describe('P - Send emails archive reminders', () => {
      let loggedInAdmin: LoggedUser;
      let loggedInCandidate: LoggedUser;
      let loggedInCoach: LoggedUser;

      beforeEach(async () => {
        loggedInAdmin = await usersHelper.createLoggedInUser({
          role: UserRoles.ADMIN,
        });
        loggedInCandidate = await usersHelper.createLoggedInUser({
          role: UserRoles.CANDIDATE,
        });
        loggedInCoach = await usersHelper.createLoggedInUser({
          role: UserRoles.COACH,
        });
      });

      it('Should respond 201 and send 5 email when logged as admin', async () => {
        const originalOpportunities = await databaseHelper.createEntities(
          opportunityFactory,
          5,
          {},
          {},
          true
        );
        const originalOpportunitiesIds = originalOpportunities.map(({ id }) => {
          return id;
        });
        const response: APIResponse<
          OpportunitiesController['postSendReminderArchive']
        > = await request(app.getHttpServer())
          .post(`${route}/sendReminderArchive`)
          .set('authorization', `Token ${loggedInAdmin.token}`)
          .send({ ids: originalOpportunitiesIds });
        expect(response.status).toBe(201);
      });

      it('Should respond 403 when logged as coach', async () => {
        const originalOpportunities = await databaseHelper.createEntities(
          opportunityFactory,
          5,
          {},
          {},
          true
        );
        const originalOpportunitiesIds = originalOpportunities.map(({ id }) => {
          return id;
        });
        const response: APIResponse<
          OpportunitiesController['postSendReminderArchive']
        > = await request(app.getHttpServer())
          .post(`${route}/sendReminderArchive`)
          .set('authorization', `Token ${loggedInCoach.token}`)
          .send({ ids: originalOpportunitiesIds });
        expect(response.status).toBe(403);
      });

      it('Should respond 403 when logged as candidate', async () => {
        const originalOpportunities = await databaseHelper.createEntities(
          opportunityFactory,
          5,
          {},
          {},
          true
        );
        const originalOpportunitiesIds = originalOpportunities.map(({ id }) => {
          return id;
        });
        const response: APIResponse<
          OpportunitiesController['postSendReminderArchive']
        > = await request(app.getHttpServer())
          .post(`${route}/sendReminderArchive`)
          .set('authorization', `Token ${loggedInCandidate.token}`)
          .send({ ids: originalOpportunitiesIds });
        expect(response.status).toBe(403);
      });
    });
  });
});
