import fs from 'fs';
import { Server } from 'http';
import os from 'os';
import path from 'path';
import {
  BadRequestException,
  NotFoundException,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { LoggedInUser, UsersHelper } from '../users/users.helper';
import { CompaniesService } from 'src/companies/companies.service';
import { CompanyCreationContext } from 'src/companies/companies.types';
import { generateSlackMsgConfigNewCompany } from 'src/companies/companies.utils';
import { CompanyInvitationsService } from 'src/companies/company-invitations.service';
import { CompanyUsersService } from 'src/companies/company-user.service';
import { CompanyUserRole } from 'src/companies/company-user.utils';
import { Company } from 'src/companies/models/company.model';
import { Department } from 'src/departments/models/department.model';
import { S3Service } from 'src/external-services/aws/s3.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { slackChannels } from 'src/external-services/slack/slack.types';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { UserRoles } from 'src/users/users.types';
import { BusinessSectorFactory } from 'tests/business-sectors/business-sector.factory';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { DepartmentHelper } from 'tests/departments/department.helper';
import { S3Mocks, SlackMocks } from 'tests/mocks.types';
import { CompaniesHelper } from './companies.helper';
import { CompanyFactory } from './company.factory';

const UNKNOWN_UUID = '3f1c2a52-2b0c-4a0a-9a2e-0f3c9f7a1b11';

describe('Companies management', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let companiesHelper: CompaniesHelper;
  let companyFactory: CompanyFactory;
  let departmentHelper: DepartmentHelper;
  let businessSectorFactory: BusinessSectorFactory;
  let companiesService: CompaniesService;
  let companyUsersService: CompanyUsersService;
  let invitationsService: CompanyInvitationsService;
  let department01: Department;

  const queuesService = {
    addToWorkQueue: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useValue(queuesService)
      .overrideProvider(SlackService)
      .useValue(SlackMocks)
      .overrideProvider(S3Service)
      .useValue(S3Mocks)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    companiesHelper = moduleFixture.get(CompaniesHelper);
    companyFactory = moduleFixture.get(CompanyFactory);
    departmentHelper = moduleFixture.get(DepartmentHelper);
    businessSectorFactory = moduleFixture.get(BusinessSectorFactory);
    companiesService = moduleFixture.get(CompaniesService);
    companyUsersService = moduleFixture.get(CompanyUsersService);
    invitationsService = moduleFixture.get(CompanyInvitationsService);

    await departmentHelper.deleteAllDepartments();
    await departmentHelper.seedDepartments();
    department01 = await departmentHelper.findOne({ value: '01' });
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    queuesService.addToWorkQueue.mockReset();
    queuesService.addToWorkQueue.mockResolvedValue({ id: 'job-1' });
    SlackMocks.getUserIdByEmail.mockReset();
    SlackMocks.sendMessage.mockReset();
  });

  const createAdminOf = async (company: Company) => {
    const admin = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
    await companiesHelper.linkCompanyToUser({
      userId: admin.user.id,
      companyId: company.id,
      role: CompanyUserRole.EXECUTIVE,
      isAdmin: true,
    });
    return admin;
  };

  const createMemberOf = async (company: Company) => {
    const member = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
    await companiesHelper.linkCompanyToUser({
      userId: member.user.id,
      companyId: company.id,
      role: CompanyUserRole.EMPLOYEE,
      isAdmin: false,
    });
    return member;
  };

  describe('GET /companies (filters and validation)', () => {
    it('only returns the companies of the requested business sectors', async () => {
      const sector = await businessSectorFactory.create({ name: 'Cuisine' });
      const other = await businessSectorFactory.create({ name: 'Transport' });
      const inSector = await companyFactory.create({ name: 'Bistro' });
      const elsewhere = await companyFactory.create({ name: 'Taxi' });
      await companiesService.updateBusinessSectors(inSector.id, [sector.id]);
      await companiesService.updateBusinessSectors(elsewhere.id, [other.id]);

      const response = await request(server).get(
        `/companies?limit=10&offset=0&onlyWithReferent=false&businessSectorIds=${sector.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.map((c: Company) => c.id)).toEqual([inSector.id]);
    });

    it('rejects a department filter that is not a UUID', async () => {
      const response = await request(server).get(
        '/companies?limit=10&offset=0&onlyWithReferent=false&departments=not-a-uuid'
      );

      expect(response.status).toBe(400);
    });

    it.each([
      'limit=abc&offset=0&onlyWithReferent=false',
      'limit=10&offset=abc&onlyWithReferent=false',
    ])('rejects non numeric pagination (%s)', async (query) => {
      const response = await request(server).get(`/companies?${query}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /companies/:companyId', () => {
    it('returns the company to a logged in user', async () => {
      const company = await companyFactory.create({ name: 'ACME' });
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await request(server)
        .get(`/companies/${company.id}`)
        .set('authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({ id: company.id, name: 'ACME' })
      );
    });

    it('refuses an anonymous user', async () => {
      const company = await companyFactory.create();

      const response = await request(server).get(`/companies/${company.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /companies/:companyId/collaborators', () => {
    let company: Company;
    let admin: LoggedInUser;
    let member: LoggedInUser;

    beforeEach(async () => {
      company = await companyFactory.create({ name: 'ACME' });
      admin = await createAdminOf(company);
      member = await createMemberOf(company);
      await invitationsService.inviteCollaborators(
        { id: admin.user.id } as never,
        company.id,
        ['pending@example.org']
      );
    });

    it('shows the collaborators and the pending invitations to a company admin', async () => {
      const response = await request(server)
        .get(`/companies/${company.id}/collaborators`)
        .set('authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(200);
      expect(
        response.body.users.map((u: { id: string }) => u.id).sort()
      ).toEqual([admin.user.id, member.user.id].sort());
      expect(response.body.pendingInvitations).toEqual([
        expect.objectContaining({ email: 'pending@example.org' }),
      ]);
    });

    it('hides the pending invitations from a simple collaborator', async () => {
      const response = await request(server)
        .get(`/companies/${company.id}/collaborators`)
        .set('authorization', `Bearer ${member.token}`);

      expect(response.status).toBe(200);
      expect(response.body.pendingInvitations).toBeUndefined();
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server).get(
        `/companies/${company.id}/collaborators`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /companies', () => {
    // The route is throttled to 5 calls per minute: this block makes 4
    it('updates the company of the logged in user, its business sectors and its department', async () => {
      const company = await companyFactory.create({ name: 'ACME' });
      const admin = await createAdminOf(company);
      const sector = await businessSectorFactory.create({ name: 'Cuisine' });

      const response = await request(server)
        .put('/companies')
        .set('authorization', `Bearer ${admin.token}`)
        .send({
          description: 'New description',
          url: 'https://acme.example.org',
          businessSectorIds: [sector.id],
          departmentId: department01.id,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          id: company.id,
          description: 'New description',
          url: 'https://acme.example.org',
        })
      );
      expect(
        response.body.businessSectors.map((s: { id: string }) => s.id)
      ).toEqual([sector.id]);
      expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
        Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY,
        { name: 'ACME', department: department01.displayName }
      );
    });

    it('replaces the previous business sectors by the new list', async () => {
      const company = await companyFactory.create();
      const admin = await createAdminOf(company);
      const first = await businessSectorFactory.create({ name: 'Cuisine' });
      const second = await businessSectorFactory.create({ name: 'Transport' });
      await companiesService.updateBusinessSectors(company.id, [first.id]);

      const response = await request(server)
        .put('/companies')
        .set('authorization', `Bearer ${admin.token}`)
        .send({ businessSectorIds: [second.id] });

      expect(response.status).toBe(200);
      expect(
        response.body.businessSectors.map((s: { id: string }) => s.id)
      ).toEqual([second.id]);
    });

    it('answers 404 when the user has no company', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });

      const response = await request(server)
        .put('/companies')
        .set('authorization', `Bearer ${user.token}`)
        .send({ description: 'x' });

      expect(response.status).toBe(404);
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server)
        .put('/companies')
        .send({ description: 'x' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /companies/logo', () => {
    it('answers 400 when no file is sent', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });

      const response = await request(server)
        .post('/companies/logo')
        .set('authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(400);
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server).post('/companies/logo');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /companies/:companyId/invite-collaborators (validation)', () => {
    let company: Company;
    let admin: LoggedInUser;

    beforeEach(async () => {
      company = await companyFactory.create();
      admin = await createAdminOf(company);
    });

    // The route is throttled to 5 calls per minute: this block makes 4 calls
    it.each([
      ['no email', []],
      ['an invalid email', ['not-an-email']],
      [
        'more than 100 emails',
        Array.from({ length: 101 }, (_, i) => `user${i}@example.org`),
      ],
    ])('rejects %s', async (_label, emails) => {
      const response = await request(server)
        .post(`/companies/${company.id}/invite-collaborators`)
        .set('authorization', `Bearer ${admin.token}`)
        .send({ emails });

      expect(response.status).toBe(400);
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server)
        .post(`/companies/${company.id}/invite-collaborators`)
        .send({ emails: ['a@example.org'] });

      expect(response.status).toBe(401);
    });
  });

  describe('CompaniesService', () => {
    const creator = {
      id: 'creator-id',
      email: 'creator@example.org',
      firstName: 'Cre',
      lastName: 'Ator',
      zone: 'PARIS',
    } as never;

    it('creates a company, creates it in the external database and notifies the moderation channel', async () => {
      SlackMocks.getUserIdByEmail.mockResolvedValue('U123');

      const company = await companiesService.create(
        { name: 'New Co' },
        creator,
        CompanyCreationContext.REGISTRATION
      );
      await new Promise((resolve) => setImmediate(resolve));

      expect(company.name).toBe('New Co');
      expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
        Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY,
        { name: 'New Co', userId: 'creator-id' }
      );
      expect(SlackMocks.sendMessage).toHaveBeenCalledWith(
        slackChannels.ENTOURAGE_PRO_MODERATION,
        undefined,
        'Nouvelle entreprise créée : New Co'
      );
    });

    it('can skip the external database', async () => {
      await companiesService.create(
        { name: 'Local Co' },
        creator,
        undefined,
        false
      );

      expect(queuesService.addToWorkQueue).not.toHaveBeenCalled();
    });

    it('does not notify Slack when the zone of the creator is unknown', async () => {
      await companiesService.create(
        { name: 'Zoneless Co' },
        { ...(creator as object), zone: null } as never,
        undefined,
        false
      );

      expect(SlackMocks.getUserIdByEmail).not.toHaveBeenCalled();
    });

    it('finds an existing company by name instead of creating a duplicate', async () => {
      const existing = await companyFactory.create({ name: 'Same Name' });

      const found = await companiesService.findOrCreateByName(
        'Same Name',
        creator,
        undefined,
        false
      );

      expect(found.id).toBe(existing.id);
      expect(queuesService.addToWorkQueue).not.toHaveBeenCalled();
    });

    it('creates the company when the name is unknown', async () => {
      const created = await companiesService.findOrCreateByName(
        'Brand New',
        creator,
        undefined,
        false
      );

      expect((await companiesService.findOneByName('Brand New')).id).toBe(
        created.id
      );
    });

    it('fails to update an unknown company', async () => {
      await expect(
        companiesService.update(UNKNOWN_UUID, { description: 'x' })
      ).rejects.toThrow(NotFoundException);
    });

    it('does not touch the external database when asked not to', async () => {
      const company = await companyFactory.create();

      await companiesService.update(
        company.id,
        { departmentId: department01.id },
        false
      );

      expect(queuesService.addToWorkQueue).not.toHaveBeenCalled();
    });

    it('fails to update the business sectors of an unknown company', async () => {
      await expect(
        companiesService.updateBusinessSectors(UNKNOWN_UUID, [])
      ).rejects.toThrow(NotFoundException);
    });

    it('uploads a logo to S3 and stores its url', async () => {
      const company = await companyFactory.create();
      const file = path.join(os.tmpdir(), `logo-${Date.now()}.png`);
      fs.writeFileSync(file, 'png');
      S3Mocks.upload.mockResolvedValueOnce({
        key: 'k',
        publicUrl: 'https://cdn.example.org/logo.png',
      });

      await companiesService.uploadLogo(company.id, { path: file } as never);
      fs.unlinkSync(file);

      expect(S3Mocks.upload).toHaveBeenCalledWith(
        expect.any(Buffer),
        'image/png',
        `${company.id}.png`,
        false
      );
      expect((await companiesService.findOne(company.id)).logoUrl).toBe(
        'https://cdn.example.org/logo.png'
      );
    });

    it('wraps the failures of the logo upload', async () => {
      const company = await companyFactory.create();

      await expect(
        companiesService.uploadLogo(company.id, {
          path: '/does/not/exist.png',
        } as never)
      ).rejects.toThrow('Failed to upload logo');
    });

    it('ignores a missing logo file', async () => {
      await expect(
        companiesService.uploadLogo('any', undefined)
      ).resolves.toBeUndefined();
    });
  });

  describe('generateSlackMsgConfigNewCompany', () => {
    const company = { id: 'c1', name: 'ACME' };
    const user = {
      email: 'u@example.org',
      firstName: 'Ada',
      lastName: 'Lovelace',
    };

    it('mentions the Slack referent when there is one', () => {
      const config = generateSlackMsgConfigNewCompany(
        company,
        user,
        'U42',
        CompanyCreationContext.COACH_LINKING
      );

      expect(config.context).toEqual([
        {
          title: "Utilisateur ayant créé l'entreprise",
          content: 'Ada Lovelace <u@example.org>',
        },
        { title: 'Référent Slack', content: '<@U42>' },
      ]);
      expect(JSON.stringify(config.msgParts)).toContain('Entreprise actuelle');
    });

    it('leaves the referent out when there is none', () => {
      const config = generateSlackMsgConfigNewCompany(company, user, null);

      expect(config.context).toHaveLength(1);
      expect(JSON.stringify(config.msgParts)).toContain('Inconnu');
    });
  });

  describe('CompanyUsersService', () => {
    const asUser = (user: LoggedInUser) =>
      ({
        id: user.user.id,
        email: user.user.email,
        firstName: user.user.firstName,
        lastName: user.user.lastName,
        zone: user.user.zone,
      }) as never;

    it('links a user to a company and refuses a second company', async () => {
      const company = await companyFactory.create();
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });

      const link = await companyUsersService.createCompanyUser({
        userId: user.user.id,
        companyId: company.id,
        role: CompanyUserRole.EMPLOYEE,
        isAdmin: false,
      });

      expect(link.companyId).toBe(company.id);
      await expect(
        companyUsersService.createCompanyUser({
          userId: user.user.id,
          companyId: (await companyFactory.create()).id,
          role: CompanyUserRole.EMPLOYEE,
          isAdmin: false,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('finds a company user and the admins of a company', async () => {
      const company = await companyFactory.create();
      const admin = await createAdminOf(company);
      const member = await createMemberOf(company);

      expect(
        (
          await companyUsersService.findOneCompanyUser(
            company.id,
            member.user.id
          )
        ).userId
      ).toBe(member.user.id);
      expect(
        (await companyUsersService.findOneCompanyUser(company.id)).companyId
      ).toBe(company.id);
      const admins = await companyUsersService.findAdminsByCompanyId(
        company.id
      );
      expect(admins.map((a) => a.id)).toEqual([admin.user.id]);
    });

    it('links a coach to a company by name, creating it, and updates the external database', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });

      const link = await companyUsersService.linkUserToCompany(
        asUser(coach),
        'Fresh Co'
      );

      const company = await companiesService.findOneByName('Fresh Co');
      expect(link.companyId).toBe(company.id);
      expect(link.isAdmin).toBe(false);
      expect(link.role).toBe('employee');
      expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
        Jobs.UPDATE_SALESFORCE_USER_COMPANY,
        { userId: coach.user.id, companyId: company.id }
      );
      // The company creation itself never goes through Salesforce here
      expect(queuesService.addToWorkQueue).not.toHaveBeenCalledWith(
        Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY,
        expect.anything()
      );
    });

    it('keeps the existing link when the company does not change', async () => {
      const company = await companyFactory.create({ name: 'Same' });
      const coach = await createMemberOf(company);

      const link = await companyUsersService.linkUserToCompany(
        asUser(coach),
        'Same',
        false
      );

      expect(link.companyId).toBe(company.id);
    });

    it('moves a coach from a company to another one', async () => {
      const oldCompany = await companyFactory.create({ name: 'Old' });
      const coach = await createMemberOf(oldCompany);

      const link = await companyUsersService.linkUserToCompany(
        asUser(coach),
        'New',
        false
      );

      const newCompany = await companiesService.findOneByName('New');
      expect(link.companyId).toBe(newCompany.id);
      expect(
        await companyUsersService.findOneCompanyUser(
          oldCompany.id,
          coach.user.id
        )
      ).toBeNull();
    });

    it('unlinks a coach when the company name is null', async () => {
      const company = await companyFactory.create();
      const coach = await createMemberOf(company);

      const result = await companyUsersService.linkUserToCompany(
        asUser(coach),
        null
      );

      expect(result).toBeNull();
      expect(
        await companyUsersService.findOneCompanyUser(company.id, coach.user.id)
      ).toBeNull();
      expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(
        Jobs.UPDATE_SALESFORCE_USER_COMPANY,
        { userId: coach.user.id, companyId: null }
      );
    });
  });

  describe('CompanyInvitationsService', () => {
    let company: Company;
    let admin: LoggedInUser;

    beforeEach(async () => {
      company = await companyFactory.create({ name: 'ACME' });
      admin = await createAdminOf(company);
    });

    it('creates one invitation per email and mails each invited person', async () => {
      await invitationsService.inviteCollaborators(
        { id: admin.user.id, firstName: 'Ad', zone: 'PARIS' } as never,
        company.id,
        ['a@example.org', 'b@example.org']
      );

      const sentTo = queuesService.addToWorkQueue.mock.calls
        .filter(([job]) => job === Jobs.SEND_MAIL)
        .map(([, mail]) => mail.toEmail);
      expect(sentTo).toEqual(['a@example.org', 'b@example.org']);
      const response =
        await companiesService.findOneWithCompanyUsersAndPendingInvitations(
          company.id,
          true
        );
      expect(response.pendingInvitations.map((i) => i.email).sort()).toEqual([
        'a@example.org',
        'b@example.org',
      ]);
    });

    it('refuses an empty list of emails', async () => {
      await expect(
        invitationsService.inviteCollaborators(
          { id: admin.user.id } as never,
          company.id,
          []
        )
      ).rejects.toThrow('No emails provided for invitation');
    });

    it('refuses an unknown company', async () => {
      await expect(
        invitationsService.inviteCollaborators(
          { id: admin.user.id } as never,
          UNKNOWN_UUID,
          ['a@example.org']
        )
      ).rejects.toThrow('not found');
    });

    it('rolls the invitation back when its mail cannot be queued', async () => {
      queuesService.addToWorkQueue.mockRejectedValue(new Error('queue down'));

      await expect(
        invitationsService.inviteCollaborators(
          { id: admin.user.id } as never,
          company.id,
          ['a@example.org']
        )
      ).rejects.toThrow('queue down');

      const response =
        await companiesService.findOneWithCompanyUsersAndPendingInvitations(
          company.id,
          true
        );
      expect(response.pendingInvitations).toEqual([]);
    });

    it('finds, updates and resolves the admins of an invitation', async () => {
      await invitationsService.inviteCollaborators(
        { id: admin.user.id } as never,
        company.id,
        ['a@example.org']
      );
      const response =
        await companiesService.findOneWithCompanyUsersAndPendingInvitations(
          company.id,
          true
        );
      const invitationId = response.pendingInvitations[0].id;

      const found = await invitationsService.findOneById(invitationId);
      expect(found.company.id).toBe(company.id);
      const updated = await invitationsService.update(invitationId, {
        userId: admin.user.id,
      });
      expect(updated.userId).toBe(admin.user.id);
      const admins =
        await invitationsService.getCompanyAdminsByInvitationId(invitationId);
      expect(admins.map((a) => a.id)).toEqual([admin.user.id]);
    });

    it('fails on an unknown invitation', async () => {
      await expect(invitationsService.update(UNKNOWN_UUID, {})).rejects.toThrow(
        'not found'
      );
      await expect(
        invitationsService.getCompanyAdminsByInvitationId(UNKNOWN_UUID)
      ).rejects.toThrow('not found');
    });
  });
});
