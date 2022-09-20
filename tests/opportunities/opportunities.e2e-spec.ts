import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  AirtableMocks,
  BitlyMocks,
  CacheMocks,
  MailchimpMocks,
  QueueMocks,
  SalesforceMocks,
} from '../mocks.types';
import { AirtableService } from 'src/airtable/airtable.service';
import { LoggedUser } from 'src/auth/auth.types';
import { BitlyService } from 'src/bitly/bitly.service';
import { MailchimpService } from 'src/mails/mailchimp.service';
import { Opportunity } from 'src/opportunities/models';
import { OpportunitiesController } from 'src/opportunities/opportunities.controller';
import { OfferStatuses } from 'src/opportunities/opportunities.types';
import { Queues } from 'src/queues/queues.types';
import { SalesforceService } from 'src/salesforce/salesforce.service';
import { User } from 'src/users/models/user.model';
import { UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { UserCandidatsHelper } from 'tests/users/user-candidats.helper';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';
import { OpportunityUsersHelper } from './opportunity-users.helper';
import { OpportunityFactory } from './opportunity.factory';

describe('Opportunities', () => {
  let app: INestApplication;

  const route = '/opportunity';

  let databaseHelper: DatabaseHelper;
  /*  let opportunitiesHelper: OpportunitiesHelper;*/
  let opportunityFactory: OpportunityFactory;
  let opportunityUsersHelper: OpportunityUsersHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;
  let userCandidatsHelper: UserCandidatsHelper;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(QueueMocks)
      .overrideProvider(MailchimpService)
      .useValue(MailchimpMocks)
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
    /*opportunitiesHelper =
      moduleFixture.get<OpportunitiesHelper>(OpportunitiesHelper);*/
    opportunityUsersHelper = moduleFixture.get<OpportunityUsersHelper>(
      OpportunityUsersHelper
    );
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    userCandidatsHelper =
      moduleFixture.get<UserCandidatsHelper>(UserCandidatsHelper);
    /*
    opportunities = [
      ...(await databaseHelper.createEntities(
        opportunityFactory,
        nbOpportunity / 2,
        {
          isValidated: true,
          isPublic: true,
          department: 'Rhône (69)',
        },
        { businessLines: ['id', 'aa'] },
        true
      )),
      ...(await databaseHelper.createEntities(
        opportunityFactory,
        nbOpportunity / 2,
        {
          isValidated: true,
          isPublic: true,
          department: 'Paris (75)',
        },
        { businessLines: ['id', 'aa'] },
        true
      )),
    ];

    await databaseHelper.createEntities(
      opportunityFactory,
      2,
      {
        isValidated: false,
        isPublic: false,
        department: 'Paris (75)',
      },
      { businessLines: ['id', 'aa'] },
      true
    );

    opportunitiesId = opportunities.map((o) => {
      return o.id;
    });

    const admin = await userFactory.create({
      role: UserRoles.ADMIN,
      password: 'admin',
    });
    let coach = await userFactory.create({
      role: UserRoles.COACH,
      password: 'coach',
    });
    let candidate = await userFactory.create({
      role: UserRoles.CANDIDAT,
      password: 'candidate',
    });
    privateOpportunities = [
      ...(await databaseHelper.createEntities(
        opportunityFactory,
        nbPrivateOpportunity / 2,
        {
          isValidated: true,
          isPublic: false,
          department: 'Rhône (69)',
        },
        { businessLines: ['id', 'aa'] },
        true
      )),
      ...(await databaseHelper.createEntities(
        opportunityFactory,
        nbPrivateOpportunity / 2,
        {
          isValidated: true,
          isPublic: false,
          department: 'Paris (75)',
        },
        { businessLines: ['id', 'aa'] },
        true
      )),
    ];
    const privateOpportunitiesId = privateOpportunities.map((op) => {
      return op.id;
    });

    opportunitiesCandidat =
      await opportunityUsersHelper.associateManyOpportunityUsers(
        privateOpportunitiesId,
        candidate.id
      );

    const publicOpportunitiesToAssociate = await databaseHelper.createEntities(
      opportunityFactory,
      nbPublicOpportunitiesToAssociate,
      {
        isValidated: true,
        isPublic: true,
        department: 'Rhône (69)',
      },
      { businessLines: ['id', 'aa'] },
      true
    );

    await opportunityUsersHelper.associateManyOpportunityUsers(
      publicOpportunitiesToAssociate.map((opp) => {
        return opp.id;
      }),
      candidate.id
    );
    /!*
    ({ coach, candidate } = await userCandidatsHelper.associateCoachAndCandidat(
      coach,
      candidate
    ));
    loggedInAdmin = await usersHelper.createLoggedInUser(admin, {}, false);
    loggedInCoach = await usersHelper.createLoggedInUser(coach, {}, false);
    loggedInCandidate = await usersHelper.createLoggedInUser(
      candidate,
      {},
      false
    );*!/
    otherCandidat = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDAT,
      password: 'user',
    });
    otherOpportunity = await opportunityFactory.create({
      isValidated: true,
      isPublic: false,
    });

    opportunityOtherCandidat = await opportunityFactory.create({
      isValidated: true,
      isPublic: true,
    });

    await opportunityUsersHelper.associateOpportunityUser(
      opportunityOtherCandidat.id,
      otherCandidat.user.id
    );

    await opportunityFactory.create({
      isValidated: false,
      isPublic: true,
      isArchived: false,
    });
    await opportunityFactory.create({
      isValidated: false,
      isPublic: false,
      isArchived: false,
    });

    await opportunityFactory.create({
      isValidated: false,
      isPublic: true,
      isArchived: true,
    });

    await opportunityFactory.create({
      isValidated: false,
      isPublic: false,
      isArchived: true,
    });

    const opportunity1ForFilters = await opportunityFactory.create(
      {
        isValidated: true,
        isPublic: false,
        department: 'Rhône (69)',
      },
      { businessLines: ['aa'] }
    );

    await opportunityUsersHelper.associateOpportunityUser(
      opportunity1ForFilters.id,
      loggedInCandidate.user.id,
      {
        status: OfferStatuses.INTERVIEW.value,
        archived: false,
        recommended: false,
      }
    );

    const opportunity2ForFilters = await opportunityFactory.create(
      {
        isValidated: true,
        isPublic: true,
        department: 'Rhône (69)',
      },
      { businessLines: ['id'] }
    );

    await opportunityUsersHelper.associateOpportunityUser(
      opportunity2ForFilters.id,
      loggedInCandidate.user.id,
      {
        status: OfferStatuses.CONTACTED.value,
        archived: false,
        recommended: false,
      }
    );
    const opportunity3ForFilters = await opportunityFactory.create(
      {
        isValidated: true,
        isPublic: true,
        department: 'Rhône (69)',
      },
      { businessLines: ['aa'] }
    );

    await opportunityUsersHelper.associateOpportunityUser(
      opportunity3ForFilters.id,
      loggedInCandidate.user.id,
      {
        status: OfferStatuses.INTERVIEW.value,
        archived: false,
        recommended: false,
      }
    );

    const opportunity4ForFilters = await opportunityFactory.create(
      {
        isValidated: true,
        isPublic: true,
        department: 'Rhône (69)',
      },
      { businessLines: ['id'] }
    );

    await opportunityUsersHelper.associateOpportunityUser(
      opportunity4ForFilters.id,
      loggedInCandidate.user.id,
      {
        status: OfferStatuses.INTERVIEW.value,
        archived: true,
        recommended: false,
      }
    );

    const opportunity5ForFilters = await opportunityFactory.create(
      {
        isValidated: false,
        isPublic: false,
        department: 'Rhône (69)',
      },
      { businessLines: ['aa'] }
    );

    await opportunityUsersHelper.associateOpportunityUser(
      opportunity5ForFilters.id,
      loggedInCandidate.user.id,
      {
        status: OfferStatuses.INTERVIEW.value,
        archived: false,
        recommended: true,
      }
    );

    const opportunity6ForFilters = await opportunityFactory.create(
      {
        isValidated: true,
        isPublic: true,
        department: 'Rhône (69)',
      },
      { businessLines: ['id'] }
    );

    await opportunityUsersHelper.associateOpportunityUser(
      opportunity6ForFilters.id,
      loggedInCandidate.user.id,
      {
        status: OfferStatuses.INTERVIEW.value,
        archived: false,
        recommended: false,
      }
    );

    const opportunity7ForFilters = await opportunityFactory.create(
      {
        isValidated: true,
        isPublic: true,
        department: 'Rhône (69)',
      },
      { businessLines: ['aa'] }
    );

    await opportunityUsersHelper.associateOpportunityUser(
      opportunity7ForFilters.id,
      loggedInCandidate.user.id,
      {
        status: OfferStatuses.INTERVIEW.value,
        archived: false,
        recommended: false,
      }
    );

    const opportunity8ForFilters = await opportunityFactory.create(
      {
        isValidated: true,
        isPublic: true,
        department: 'Rhône (69)',
      },
      { businessLines: ['aa'] }
    );

    await opportunityUsersHelper.associateOpportunityUser(
      opportunity8ForFilters.id,
      loggedInCandidate.user.id,
      {
        status: OfferStatuses.INTERVIEW.value,
        archived: false,
        recommended: false,
      }
    );

    candidatExternalOpportunity = await opportunityFactory.create({
      isValidated: true,
      isPublic: false,
      isArchived: false,
      isExternal: true,
    });

    otherCandidatExternalOpportunity = await opportunityFactory.create({
      isValidated: true,
      isPublic: false,
      isArchived: false,
      isExternal: true,
    });

    await opportunityUsersHelper.associateOpportunityUser(
      candidatExternalOpportunity.id,
      loggedInCandidate.user.id
    );

    await opportunityUsersHelper.associateOpportunityUser(
      otherCandidatExternalOpportunity.id,
      otherCandidat.user.id
    );*/
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
          isValidated: true,
          isPublic: true,
        });

        privateOpportunity = await opportunityFactory.create({
          isValidated: true,
          isPublic: false,
        });

        await opportunityUsersHelper.associateOpportunityUser(
          privateOpportunity.id,
          loggedInCandidate.user.id
        );

        notValidatedOpportunity = await opportunityFactory.create({
          isValidated: false,
          isPublic: false,
        });

        await opportunityUsersHelper.associateOpportunityUser(
          notValidatedOpportunity.id,
          loggedInCandidate.user.id
        );

        otherPrivateOpportunity = await opportunityFactory.create({
          isValidated: true,
          isPublic: false,
        });

        await opportunityUsersHelper.associateOpportunityUser(
          otherPrivateOpportunity.id,
          candidate.id
        );
      });

      describe('/:id - Get one opportunity', () => {
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
    /*    describe('R - Read many Opportunities', () => {
      describe('Read all opportunities - /admin', () => {
        it('Should return 200 and a list of all opportunities, if logged in admin', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/admin`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(3);
        });

        it('Should return 200 and a list of searched opportunities, if logged in admin', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/admin?query='e'`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
        });
        it('Should return 403, if not logged in admin', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/admin`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        describe('Read all opportunities as admin with filters', () => {
          it('Should return 200, and all the opportunities that matches the pending filter', async () => {
            const response = await request(app.getHttpServer())
              .get(`${route}/admin?type=${OfferAdminTabs.PENDING}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(10);
            expect(response.body).not.toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  isValidated: true,
                }),
                expect.objectContaining({
                  isExternal: true,
                }),
                expect.objectContaining({
                  isArchived: true,
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the validated filter', async () => {
            const response = await request(app.getHttpServer())
              .get(`${route}/admin?type=validated`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(30);
            expect(response.body).not.toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  isValidated: false,
                }),
                expect.objectContaining({
                  isExternal: true,
                }),
                expect.objectContaining({
                  isArchived: true,
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the external filter', async () => {
            const response = await request(app.getHttpServer())
              .get(`${route}/admin?type=${OfferAdminTabs.EXTERNAL}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(5);
            expect(response.body).not.toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  isValidated: false,
                }),
                expect.objectContaining({
                  isExternal: false,
                }),
                expect.objectContaining({
                  isArchived: false,
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the archived filter', async () => {
            const response = await request(app.getHttpServer())
              .get(`${route}/admin?type=${OfferAdminTabs.ARCHIVED}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body).not.toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  isArchived: false,
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the department filters', async () => {
            const response = await request(app.getHttpServer())
              .get(`${route}/admin?department[]=Rhône (69)`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(21);
            expect(response.body).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  department: 'Rhône (69)',
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the isPublic filters', async () => {
            const response = await request(app.getHttpServer())
              .get(`${route}/admin?isPublic[]=true`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(29);
            expect(response.body).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  isPublic: true,
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the businessLines filters', async () => {
            const response = await request(app.getHttpServer())
              .get(`${route}/admin?businessLines[]=id`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(26);
            expect(response.body).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  businessLines: expect.arrayContaining([
                    expect.objectContaining({ name: 'id' }),
                  ]),
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the status filters', async () => {
            const response = await request(app.getHttpServer())
              .get(`${route}/admin?status[]=${OfferStatuses.INTERVIEW.value}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(7);
            expect(response.body).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  opportunityUsers: expect.arrayContaining([
                    expect.objectContaining({
                      status: OfferStatuses.INTERVIEW.value,
                    }),
                  ]),
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the search query', async () => {
            const response = await request(app.getHttpServer())
              .get(`${route}/admin?search=Rhône`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(21);
            expect(response.body).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  department: 'Rhône (69)',
                }),
              ])
            );
          });
        });
      });
      describe('Count all pending opportunities - /admin', () => {
        it('Should return 200 and count of all pending opportunities, if logged in admin', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/admin/count`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.pendingOpportunities).toBe(2);
        });
        it('Should return 403, if not logged in admin', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/admin/count`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
      });

      describe("Read a user's private opportunities - /user/private/:id", () => {
        const userOpportunitiesCount = 26;
        it('Should return 403, if candidate read his opportunities', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/private/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if a coach read his associated candidate opportunities', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/private/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it("Should return 200, if a admin reads candidate's opportunities", async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/private/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(userOpportunitiesCount);
        });
        it('Should return 400, if invalid user id', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/private/1111-invalid-99999`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(400);
        });
        describe("Read user's opportunities with filters as admin", () => {
          it('Should return 200, and all the opportunities that matches the hide public filter', async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/private/${loggedInCandidate.user.id}?isPublic[]=true`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(14);
            expect(response.body).not.toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  isPublic: false,
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the department filters', async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/private/${loggedInCandidate.user.id}?department[]=Rhône (69)`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(19);
            expect(response.body).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  department: 'Rhône (69)',
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the status filters', async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/private/${loggedInCandidate.user.id}?status[]=1`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(7);
            expect(response.body).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  opportunityUsers: expect.arrayContaining([
                    expect.objectContaining({
                      status: 1,
                    }),
                  ]),
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the search query', async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/private/${loggedInCandidate.user.id}?search=Rhône`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(19);
            expect(response.body).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  department: 'Rhône (69)',
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the businessLines filters', async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/private/${loggedInCandidate.user.id}?businessLines[]=id`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(17);
            expect(response.body).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  businessLines: expect.arrayContaining([
                    expect.objectContaining({ name: 'id' }),
                  ]),
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the multiple filters (AND between different filters, OR inside each filters)', async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/private/${loggedInCandidate.user.id}?department[]=Rhône (69)&status[]=0&status[]=1&isPublic[]=true&businessLines[]=id`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(3);
            expect(response.body).not.toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  isPublic: false,
                }),
              ])
            );
            expect(response.body).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  department: 'Rhône (69)',
                }),
              ])
            );
            expect(response.body).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  opportunityUsers: expect.arrayContaining([
                    expect.objectContaining({
                      status: 0,
                    }) ||
                      expect.objectContaining({
                        status: 1,
                      }),
                  ]),
                }),
              ])
            );
            expect(response.body).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  businessLines: expect.arrayContaining([
                    expect.objectContaining({ name: 'id' }),
                  ]),
                }),
              ])
            );
          });
        });
      });
      describe("Read all user's opportunities - /user/all/:id", () => {
        const userOpportunitiesCount = 33;
        it('Should return 200, if candidate read his opportunities', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/all/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(userOpportunitiesCount);
        });
        it('Should return 200, if a coach read his associated candidate opportunities', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/all/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(userOpportunitiesCount);
        });
        it('Should return 200, if a admin read a candidates opportunities', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/all/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.offers.length).toBe(userOpportunitiesCount);
        });
        it('Should return 400, if invalid user id', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/all/1111-invalid-99999`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(400);
        });
        it('Should return 403, if candidate reads an other candidate opportunities', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/all/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${otherCandidat.token}`);
          expect(response.status).toBe(403);
        });
        it("Should return 403, if a coach read not associate candidate's opportunities", async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/all/${otherCandidat.user.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });

        describe("Read user's opportunities with filters", () => {
          it('Should return 200, and all the opportunities that matches the private filter', async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/all/${loggedInCandidate.user.id}?type=private`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(11);
            expect(response.body.offers).not.toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  isPublic: true,
                }),
                expect.objectContaining({
                  opportunityUsers: expect.objectContaining({
                    archived: true,
                  }),
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the public filter', async () => {
            const response = await request(app.getHttpServer())
              .get(`${route}/user/all/${loggedInCandidate.user.id}?type=public`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(21);
            expect(response.body.offers).not.toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  isPublic: false,
                }),
                expect.objectContaining({
                  opportunityUsers: expect.objectContaining({
                    archived: true,
                  }),
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the archived filter', async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/all/${loggedInCandidate.user.id}?type=archived`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(1);
            expect(response.body.offers).not.toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  opportunityUsers: expect.objectContaining({
                    archived: false,
                  }),
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the department filters', async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/all/${loggedInCandidate.user.id}?department[]=Rhône (69)`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(20);
            expect(response.body.offers).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  department: 'Rhône (69)',
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the businessLines filters', async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/all/${loggedInCandidate.user.id}?businessLines[]=id`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(24);
            expect(response.body.offers).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  businessLines: expect.arrayContaining([
                    expect.objectContaining({ name: 'id' }),
                  ]),
                }),
              ])
            );
          });
          it("Should return 200, and offers suggestions of different location if the department filters don't match", async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/all/${loggedInCandidate.user.id}?department[]=Rhône (69)&type=private`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(4);
            expect(response.body.otherOffers.length).toBe(7);
            expect(response.body.offers).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  department: 'Rhône (69)',
                }),
              ])
            );
            expect(response.body.otherOffers).not.toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  department: 'Rhône (69)',
                }),
              ])
            );
            expect(response.body.otherOffers).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  department: 'Paris (75)',
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the status filters', async () => {
            const response = await request(app.getHttpServer())
              .get(`${route}/user/all/${loggedInCandidate.user.id}?status[]=1`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(6);
            expect(response.body.offers).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  opportunityUsers: expect.objectContaining({
                    status: 1,
                  }),
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the search query', async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/all/${loggedInCandidate.user.id}?search=Rhône`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(21);
            expect(response.body.offers).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  department: 'Rhône (69)',
                }),
              ])
            );
          });
          it('Should return 200, and all the opportunities that matches the multiple filters (AND between different filters, OR inside each filters)', async () => {
            const response = await request(app.getHttpServer())
              .get(
                `${route}/user/all/${loggedInCandidate.user.id}?department[]=Rhône (69)&status[]=0&status[]=1&type=public&businessLines[]=id`
              )
              .set('authorization', `Token ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.offers.length).toBe(2);
            expect(response.body.offers).not.toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  isPublic: false,
                }),
                expect.objectContaining({
                  opportunityUsers: expect.objectContaining({
                    archived: true,
                  }),
                }),
              ])
            );
            expect(response.body.offers).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  department: 'Rhône (69)',
                }),
              ])
            );
            expect(response.body.offers).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  opportunityUsers:
                    expect.objectContaining({
                      status: 0,
                    }) ||
                    expect.objectContaining({
                      status: 1,
                    }),
                }),
              ])
            );
            expect(response.body.offers).not.toEqual(
              expect.not.arrayContaining([
                expect.objectContaining({
                  businessLines: expect.arrayContaining([
                    expect.objectContaining({ name: 'id' }),
                  ]),
                }),
              ])
            );
          });
        });
      });
      describe("Count all user's opportunities - /user/count/:id", () => {
        const userOpportunitiesCount = 8;
        it('Should return 200, if candidate counts his opportunities', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/count/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.unseenOpportunities).toBe(
            userOpportunitiesCount
          );
        });
        it('Should return 200, if a coach counts his associated candidate opportunities', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/count/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.unseenOpportunities).toBe(
            userOpportunitiesCount
          );
        });
        it('Should return 403, if a admin counts a candidate opportunities', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/count/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if candidate counts an other candidate opportunities', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/count/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${otherCandidat.token}`);
          expect(response.status).toBe(403);
        });
        it("Should return 403, if a coach counts not associate candidate's opportunities", async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/user/count/${otherCandidat.user.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
      });
    });*/
    /*
    describe('U - Update 1', () => {
      describe('Update an opportunity - /', () => {
        it('Should return 200, if admin updates an opportunity', async () => {
          const update = {
            ...opportunities[0],
            isValidated: true,
            title: 'updated title',
          };
          const response = await request(app.getHttpServer())
            .put(`${route}`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.title).toBe('updated title');
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

          const response = await request(app.getHttpServer())
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
        it('Should return 200, if admin adds a user to a public opportunity', async () => {
          const update = {
            ...opportunities[0],
            candidatesId: [otherCandidat.user.id],
          };
          const response = await request(app.getHttpServer())
            .put(`${route}`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(
            response.body.opportunityUsers.map((userOpp: OpportunityUser) => {
              return userOpp.UserId;
            })
          ).toEqual(expect.arrayContaining([otherCandidat.user.id]));
        });
        it('Should return 403, if not an admin', async () => {
          const update = {
            ...opportunities[1],
            isValidated: true,
            title: 'updated title',
          };
          const response = await request(app.getHttpServer())
            .put(`${route}`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(update);
          expect(response.status).toBe(403);
        });
      });
      describe('Update an external opportunity - /', () => {
        it('Should return 200, if logged in as candidate and updates own opportunity with authorized values', async () => {
          const newTitle = 'Updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: candidatExternalOpportunity.id,
            title: newTitle,
            company: candidatExternalOpportunity.company,
            contract: candidatExternalOpportunity.contract,
            startOfContract: candidatExternalOpportunity.startOfContract,
            endOfContract: candidatExternalOpportunity.endOfContract,
            isPartTime: candidatExternalOpportunity.isPartTime,
            department: candidatExternalOpportunity.department,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...updatedOpportunity,
              isExternal: true,
              isPublic: false,
              isValidated: true,
            })
          );
          expect(response.body.opportunityUsers.UserId).toMatch(candidateId);
        });

        it('Should return 400, if logged in as candidate and updates own opportunity with unauthorized values', async () => {
          const newTitle = 'updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: candidatExternalOpportunity.id,
            title: newTitle,
            company: candidatExternalOpportunity.company,
            contract: candidatExternalOpportunity.contract,
            startOfContract: candidatExternalOpportunity.startOfContract,
            endOfContract: candidatExternalOpportunity.endOfContract,
            isPartTime: candidatExternalOpportunity.isPartTime,
            department: candidatExternalOpportunity.department,
            businessLines: [{ name: 'id', order: 0 }],
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(400);
        });
        it('Should return 403, if logged in as candidate and updates somebody elses opportunity', async () => {
          const newTitle = 'updated title';
          const candidateId = otherCandidat.user.id;
          const updatedOpportunity = {
            id: otherCandidatExternalOpportunity.id,
            title: newTitle,
            company: otherCandidatExternalOpportunity.company,
            contract: otherCandidatExternalOpportunity.contract,
            startOfContract: otherCandidatExternalOpportunity.startOfContract,
            endOfContract: otherCandidatExternalOpportunity.endOfContract,
            isPartTime: otherCandidatExternalOpportunity.isPartTime,
            department: otherCandidatExternalOpportunity.department,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(403);
        });
        it('Should return 404, if logged in as candidate and updates non external opportunity', async () => {
          const newTitle = 'updated title';

          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: opportunities[0].id,
            title: newTitle,
            company: opportunities[0].company,
            contract: opportunities[0].contract,
            startOfContract: opportunities[0].startOfContract,
            endOfContract: opportunities[0].endOfContract,
            isPartTime: opportunities[0].isPartTime,
            department: opportunities[0].department,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(404);
        });

        it('Should return 200, if logged in as coach and updates own candidate opportunity with authorized values', async () => {
          const newTitle = 'Updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: candidatExternalOpportunity.id,
            title: newTitle,
            company: candidatExternalOpportunity.company,
            contract: candidatExternalOpportunity.contract,
            startOfContract: candidatExternalOpportunity.startOfContract,
            endOfContract: candidatExternalOpportunity.endOfContract,
            isPartTime: candidatExternalOpportunity.isPartTime,
            department: candidatExternalOpportunity.department,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...updatedOpportunity,
              isExternal: true,
              isPublic: false,
              isValidated: true,
            })
          );
          expect(response.body.opportunityUsers.UserId).toMatch(candidateId);
        });
        it('Should return 400, if logged in as coach and updates own candidate opportunity with unauthorized values', async () => {
          const newTitle = 'updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            title: newTitle,
            company: candidatExternalOpportunity.company,
            contract: candidatExternalOpportunity.contract,
            startOfContract: candidatExternalOpportunity.startOfContract,
            endOfContract: candidatExternalOpportunity.endOfContract,
            isPartTime: candidatExternalOpportunity.isPartTime,
            department: candidatExternalOpportunity.department,
            businessLines: [{ name: 'id', order: 0 }],
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(400);
        });
        it("Should return 403, if logged in as coach and creates another candidate's opportunity", async () => {
          const newTitle = 'updated title';

          const candidateId = otherCandidat.user.id;
          const updatedOpportunity = {
            id: otherCandidatExternalOpportunity.id,
            title: newTitle,
            company: otherCandidatExternalOpportunity.company,
            contract: otherCandidatExternalOpportunity.contract,
            startOfContract: otherCandidatExternalOpportunity.startOfContract,
            endOfContract: otherCandidatExternalOpportunity.endOfContract,
            isPartTime: otherCandidatExternalOpportunity.isPartTime,
            department: otherCandidatExternalOpportunity.department,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(403);
        });

        it('Should return 200, if logged in as admin and updates opportunity', async () => {
          const newTitle = 'updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: candidatExternalOpportunity.id,
            title: newTitle,
            company: candidatExternalOpportunity.company,
            contract: candidatExternalOpportunity.contract,
            startOfContract: candidatExternalOpportunity.startOfContract,
            endOfContract: candidatExternalOpportunity.endOfContract,
            isPartTime: candidatExternalOpportunity.isPartTime,
            department: candidatExternalOpportunity.department,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...updatedOpportunity,
              isExternal: true,
              isPublic: false,
              isValidated: true,
            })
          );
          expect(response.body.opportunityUsers.UserId).toMatch(candidateId);
        });
        it('Should return 404, if logged in as admin and updates non external opportunity', async () => {
          const newTitle = 'updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: opportunities[0].id,
            title: newTitle,
            company: opportunities[0].company,
            contract: opportunities[0].contract,
            startOfContract: opportunities[0].startOfContract,
            endOfContract: opportunities[0].endOfContract,
            isPartTime: opportunities[0].isPartTime,
            department: opportunities[0].department,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(404);
        });
        it('Should return 404, if logged in as admin and updates opportunity without candidateId', async () => {
          const newTitle = 'updated title';
          const updatedOpportunity = {
            id: opportunities[0].id,
            title: newTitle,
            company: opportunities[0].company,
            contract: opportunities[0].contract,
            startOfContract: opportunities[0].startOfContract,
            endOfContract: opportunities[0].endOfContract,
            isPartTime: opportunities[0].isPartTime,
            department: opportunities[0].department,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/external`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(updatedOpportunity);
          expect(response.status).toBe(404);
        });

        it('Should return 401, if not logged in', async () => {
          const newTitle = 'updated title';
          const candidateId = loggedInCandidate.user.id;
          const updatedOpportunity = {
            id: opportunities[0].id,
            title: newTitle,
            company: opportunities[0].company,
            contract: opportunities[0].contract,
            startOfContract: opportunities[0].startOfContract,
            endOfContract: opportunities[0].endOfContract,
            isPartTime: opportunities[0].isPartTime,
            department: opportunities[0].department,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/external`)
            .send({ candidateId, ...updatedOpportunity });
          expect(response.status).toBe(401);
        });
      });
      describe('Update a user opportunity association - /join', () => {
        it('Should return 200, if candidate updates his opportunities asociations', async () => {
          const update = {
            ...opportunitiesCandidat[0],
            note: 'noteUpdate',
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/join`)
            .set('authorization', `Token ${loggedInCandidate.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.note).toBe('noteUpdate');
        });
        it('Should return 200, if a coach updates his associated candidate opportunities asociations', async () => {
          const update = {
            ...opportunitiesCandidat[1],
            seen: true,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.seen).toBe(true);
        });
        it('Should return 200, if a admin updates candidate opportunities asociations', async () => {
          const update = {
            ...opportunitiesCandidat[2],
            bookmarked: true,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/join`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send(update);
          expect(response.status).toBe(200);
          expect(response.body.bookmarked).toBe(true);
        });
        it('Should return 400, if invalid user id', async () => {
          const update = {
            ...opportunitiesCandidat[3],
            UserId: '1111-invalid-99999',
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(update);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if candidate updates an other candidate opportunities asociations', async () => {
          const update = {
            ...opportunitiesCandidat[4],
            status: 1000,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/join`)
            .set('authorization', `Token ${otherCandidat.token}`)
            .send(update);
          expect(response.status).toBe(403);
        });
        it("Should return 403, if a coach updates not associate candidate's opportunities asociations", async () => {
          const update = {
            ...opportunityOtherCandidat,
            bookmarked: true,
          };
          const response = await request(app.getHttpServer())
            .put(`${route}/join`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .send(update);
          expect(response.status).toBe(403);
        });
      });
    });
    describe.skip('D - Delete 1', () => {
      it('Should return 200, if admin', async () => {
        const response = await request(app.getHttpServer())
          .delete(`${route}/${opportunitiesId[9]}`)
          .set('authorization', `Token ${loggedInAdmin.token}`);
        expect(response.status).toBe(200);
      });
      it('Should return 401, if not admin', async () => {
        const response = await request(app.getHttpServer())
          .delete(`${route}/${opportunitiesId[8]}`)
          .set('authorization', `Token ${loggedInCoach.token}`);
        expect(response.status).toBe(401);
      });
      it("Should return 401, if not opportnity doesn't exist", async () => {
        const response = await request(app.getHttpServer())
          .delete(`${route}/a824df-c9e0-42cb-adb6-02267fc9e5f6`)
          .set('authorization', `Token ${loggedInCoach.token}`);
        expect(response.status).toBe(401);
      });
    });*/
  });
});
