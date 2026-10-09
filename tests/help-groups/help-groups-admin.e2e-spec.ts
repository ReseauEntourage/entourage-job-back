import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { CompanyUserRole } from 'src/companies/company-user.utils';
import { HelpGroup, HelpGroupMembership } from 'src/help-groups/models';
import { Post, PostReply } from 'src/posts/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CompanyFactory } from 'tests/companies/company.factory';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { DiscussionFactory } from './discussion.factory';
import { HelpGroupMembershipFactory } from './help-group-membership.factory';
import { HelpGroupFactory } from './help-group.factory';
import { PostReplyFactory } from './post-reply.factory';

const ids = (items: { id: string }[]) => items.map(({ id }) => id);

describe('Help groups - Admin', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let userFactory: UserFactory;
  let companyFactory: CompanyFactory;
  let helpGroupFactory: HelpGroupFactory;
  let helpGroupMembershipFactory: HelpGroupMembershipFactory;
  let discussionFactory: DiscussionFactory;
  let postReplyFactory: PostReplyFactory;
  let helpGroupModel: typeof HelpGroup;
  let postModel: typeof Post;
  let postReplyModel: typeof PostReply;
  let membershipModel: typeof HelpGroupMembership;

  const adminRoute = '/admin/help-groups';
  const readRoute = '/help-groups';

  const validGroup = {
    name: 'Refaire un CV',
    description: 'Échanger sur la rédaction de son CV.\nEt de sa lettre.',
  };

  let admin: LoggedInUser;
  let candidate: LoggedInUser;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    companyFactory = moduleFixture.get<CompanyFactory>(CompanyFactory);
    helpGroupFactory = moduleFixture.get<HelpGroupFactory>(HelpGroupFactory);
    helpGroupMembershipFactory = moduleFixture.get<HelpGroupMembershipFactory>(
      HelpGroupMembershipFactory
    );
    discussionFactory = moduleFixture.get<DiscussionFactory>(DiscussionFactory);
    postReplyFactory = moduleFixture.get<PostReplyFactory>(PostReplyFactory);
    helpGroupModel = moduleFixture.get(getModelToken(HelpGroup));
    postModel = moduleFixture.get(getModelToken(Post));
    postReplyModel = moduleFixture.get(getModelToken(PostReply));
    membershipModel = moduleFixture.get(getModelToken(HelpGroupMembership));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    admin = await usersHelper.createLoggedInUser({ role: UserRoles.ADMIN });
    candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
  });

  const asAdmin = (req: request.Test) =>
    req.set('authorization', `Bearer ${admin.token}`);

  describe('Access restricted to Entourage admins', () => {
    it('Should return 200 when an admin gets the admin list', async () => {
      const response = await asAdmin(request(server).get(adminRoute));
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    describe.each([
      ['candidate', UserRoles.CANDIDATE, false],
      ['coach', UserRoles.COACH, false],
      ['referer', UserRoles.REFERER, false],
      ['company admin', UserRoles.COACH, true],
    ])('As a %s', (_label, role, isCompanyAdmin) => {
      let user: LoggedInUser;
      let group: HelpGroup;

      beforeEach(async () => {
        user = await usersHelper.createLoggedInUser({ role });
        if (isCompanyAdmin) {
          const company = await companyFactory.create();
          await companyFactory.linkAdminToCompany(company, user.user.id, {
            isAdmin: true,
            role: CompanyUserRole.EXECUTIVE,
          });
        }
        group = await helpGroupFactory.create({ publishedAt: null });
      });

      it.each([
        ['get', (): string => adminRoute],
        ['post', (): string => adminRoute],
        ['put', (): string => `${adminRoute}/${group.id}`],
        ['post', (): string => `${adminRoute}/${group.id}/publish`],
        ['post', (): string => `${adminRoute}/${group.id}/unpublish`],
        ['post', (): string => `${adminRoute}/${group.id}/pin`],
        ['post', (): string => `${adminRoute}/${group.id}/unpin`],
        ['post', (): string => `${adminRoute}/${group.id}/restore`],
        ['delete', (): string => `${adminRoute}/${group.id}`],
      ] as const)('Should return 403 on %s %s', async (method, getPath) => {
        const response = await request(server)
          [method](getPath())
          .set('authorization', `Bearer ${user.token}`)
          .send(validGroup);
        expect(response.status).toBe(403);

        const dbGroup = await helpGroupModel.findByPk(group.id, {
          paranoid: false,
        });
        expect(dbGroup.name).toBe(group.name);
        expect(dbGroup.publishedAt).toBeNull();
        expect(dbGroup.deletedAt).toBeNull();
        expect(await helpGroupModel.count({ paranoid: false })).toBe(1);
      });
    });

    it('Should return 401 when not logged in', async () => {
      const response = await request(server).get(adminRoute);
      expect(response.status).toBe(401);
    });
  });

  describe('Create a group', () => {
    it('Should create an unpublished group with a slug derived from its name', async () => {
      const response = await asAdmin(
        request(server).post(adminRoute).send(validGroup)
      );
      expect(response.status).toBe(201);
      expect(response.body).toEqual(
        expect.objectContaining({
          ...validGroup,
          slug: 'refaire-un-cv',
          publishedAt: null,
          pinnedAt: null,
          createdById: admin.user.id,
        })
      );

      const listResponse = await request(server)
        .get(readRoute)
        .set('authorization', `Bearer ${candidate.token}`);
      expect(listResponse.body).toEqual([]);
    });

    it('Should keep markup as plain text', async () => {
      const markup = {
        name: '<b>Groupe</b> **gras**',
        description: '<script>alert(1)</script>',
      };
      const response = await asAdmin(
        request(server).post(adminRoute).send(markup)
      );
      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining(markup));
    });

    it('Should give a distinct slug when the derived one is taken, including by a deleted group', async () => {
      await helpGroupFactory.create({
        slug: 'refaire-un-cv',
        deletedAt: new Date(),
      });
      await helpGroupFactory.create({ slug: 'refaire-un-cv-2' });

      const response = await asAdmin(
        request(server).post(adminRoute).send(validGroup)
      );
      expect(response.status).toBe(201);
      expect(response.body.slug).toBe('refaire-un-cv-3');
    });

    describe('Concurrent slug conflicts', () => {
      afterEach(() => {
        jest.restoreAllMocks();
      });

      // Stale reads of the taken slugs simulate groups created concurrently
      // between the read and the insert
      const staleTakenSlugs = (...slugs: string[]) =>
        slugs.map((slug) => ({ slug })) as unknown as HelpGroup[];

      it('Should retry with the next slug on repeated unique violations', async () => {
        for (const slug of [
          'refaire-un-cv',
          'refaire-un-cv-2',
          'refaire-un-cv-3',
        ]) {
          await helpGroupFactory.create({ slug });
        }
        jest
          .spyOn(helpGroupModel, 'findAll')
          .mockResolvedValueOnce(staleTakenSlugs())
          .mockResolvedValueOnce(staleTakenSlugs())
          .mockResolvedValueOnce(staleTakenSlugs());
        const createSpy = jest.spyOn(helpGroupModel, 'create');

        const response = await asAdmin(
          request(server).post(adminRoute).send(validGroup)
        );
        expect(response.status).toBe(201);
        expect(response.body.slug).toBe('refaire-un-cv-4');
        expect(createSpy).toHaveBeenCalledTimes(4);
      });

      it('Should give up after a bounded number of attempts', async () => {
        for (const slug of [
          'refaire-un-cv',
          'refaire-un-cv-2',
          'refaire-un-cv-3',
          'refaire-un-cv-4',
          'refaire-un-cv-5',
          'refaire-un-cv-6',
        ]) {
          await helpGroupFactory.create({ slug });
        }
        jest
          .spyOn(helpGroupModel, 'findAll')
          .mockResolvedValue(staleTakenSlugs());
        const createSpy = jest.spyOn(helpGroupModel, 'create');

        const response = await asAdmin(
          request(server).post(adminRoute).send(validGroup)
        );
        expect(response.status).toBe(500);
        expect(createSpy).toHaveBeenCalledTimes(5);
        jest.restoreAllMocks();
        expect(await helpGroupModel.count({ paranoid: false })).toBe(6);
      });
    });

    it.each([
      ['name', ''],
      ['name', '   '],
      ['name', 'a'.repeat(81)],
      ['description', ''],
      ['description', 'a'.repeat(501)],
    ])(
      'Should return 400 naming the field when %s is "%s"',
      async (field, value) => {
        const response = await asAdmin(
          request(server)
            .post(adminRoute)
            .send({ ...validGroup, [field]: value })
        );
        expect(response.status).toBe(400);
        expect(JSON.stringify(response.body.message)).toContain(field);
        expect(await helpGroupModel.count({ paranoid: false })).toBe(0);
      }
    );

    it('Should return 400 when a field is missing', async () => {
      const { description, ...missingDescription } = validGroup;
      const response = await asAdmin(
        request(server).post(adminRoute).send(missingDescription)
      );
      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body.message)).toContain('description');
    });

    it('Should accept the maximum lengths', async () => {
      const response = await asAdmin(
        request(server)
          .post(adminRoute)
          .send({
            name: 'a'.repeat(80),
            description: 'b'.repeat(500),
          })
      );
      expect(response.status).toBe(201);
    });
  });

  describe('Update a group', () => {
    it('Should update a published group, keep its slug and show the new content', async () => {
      const group = await helpGroupFactory.create({ slug: 'refaire-un-cv' });

      const response = await asAdmin(
        request(server)
          .put(`${adminRoute}/${group.id}`)
          .send({
            ...validGroup,
            name: 'Réécrire son CV',
            description: 'Nouvelle description',
          })
      );
      expect(response.status).toBe(200);
      expect(response.body.slug).toBe('refaire-un-cv');

      const pageResponse = await request(server)
        .get(`${readRoute}/refaire-un-cv`)
        .set('authorization', `Bearer ${candidate.token}`);
      expect(pageResponse.status).toBe(200);
      expect(pageResponse.body.name).toBe('Réécrire son CV');
      expect(pageResponse.body.description).toBe('Nouvelle description');
    });

    it('Should return 400 when a field is too long', async () => {
      const group = await helpGroupFactory.create();
      const response = await asAdmin(
        request(server)
          .put(`${adminRoute}/${group.id}`)
          .send({ ...validGroup, description: 'a'.repeat(501) })
      );
      expect(response.status).toBe(400);
    });

    it('Should return 404 for an unknown group', async () => {
      const response = await asAdmin(
        request(server).put(`${adminRoute}/${uuid()}`).send(validGroup)
      );
      expect(response.status).toBe(404);
    });
  });

  describe('Publish and unpublish', () => {
    it('Should show a published group to any logged-in user', async () => {
      const group = await helpGroupFactory.create({ publishedAt: null });

      const response = await asAdmin(
        request(server).post(`${adminRoute}/${group.id}/publish`)
      );
      expect(response.status).toBe(200);
      expect(response.body.publishedAt).not.toBeNull();

      const listResponse = await request(server)
        .get(readRoute)
        .set('authorization', `Bearer ${candidate.token}`);
      expect(ids(listResponse.body)).toEqual([group.id]);
    });

    it('Should hide an unpublished group, its page and its discussions, then show them again on republication', async () => {
      const group = await helpGroupFactory.create();
      await helpGroupMembershipFactory.create({
        groupId: group.id,
        userId: candidate.user.id,
      });
      const discussion = await discussionFactory.create(
        { authorId: candidate.user.id },
        group.id
      );
      await postReplyFactory.create({
        postId: discussion.id,
        authorId: candidate.user.id,
      });

      const unpublishResponse = await asAdmin(
        request(server).post(`${adminRoute}/${group.id}/unpublish`)
      );
      expect(unpublishResponse.status).toBe(200);
      expect(unpublishResponse.body.publishedAt).toBeNull();

      const asCandidate = (path: string) =>
        request(server)
          .get(path)
          .set('authorization', `Bearer ${candidate.token}`);

      expect((await asCandidate(readRoute)).body).toEqual([]);
      expect((await asCandidate(`${readRoute}/${group.slug}`)).status).toBe(
        404
      );
      expect(
        (
          await asCandidate(
            `${readRoute}/${group.slug}/discussions/${discussion.id}`
          )
        ).status
      ).toBe(404);

      await asAdmin(request(server).post(`${adminRoute}/${group.id}/publish`));

      const pageResponse = await asCandidate(`${readRoute}/${group.slug}`);
      expect(pageResponse.status).toBe(200);
      expect(pageResponse.body.membersCount).toBe(1);
      const discussionResponse = await asCandidate(
        `${readRoute}/${group.slug}/discussions/${discussion.id}`
      );
      expect(discussionResponse.status).toBe(200);
      expect(discussionResponse.body.repliesCount).toBe(1);
    });
  });

  describe('Pin', () => {
    it('Should put a pinned group on top of the list', async () => {
      const older = await helpGroupFactory.create({
        createdAt: new Date('2026-01-01'),
      });
      await helpGroupFactory.create({ createdAt: new Date('2026-02-01') });

      const response = await asAdmin(
        request(server).post(`${adminRoute}/${older.id}/pin`)
      );
      expect(response.status).toBe(200);
      expect(response.body.pinnedAt).not.toBeNull();

      const listResponse = await request(server)
        .get(readRoute)
        .set('authorization', `Bearer ${candidate.token}`);
      expect(listResponse.body[0].id).toBe(older.id);
    });

    it('Should put an unpinned group back in creation date order', async () => {
      const older = await helpGroupFactory.create({
        createdAt: new Date('2026-01-01'),
        pinnedAt: new Date(),
      });
      const newer = await helpGroupFactory.create({
        createdAt: new Date('2026-02-01'),
      });

      const response = await asAdmin(
        request(server).post(`${adminRoute}/${older.id}/unpin`)
      );
      expect(response.status).toBe(200);
      expect(response.body.pinnedAt).toBeNull();

      const listResponse = await request(server)
        .get(readRoute)
        .set('authorization', `Bearer ${candidate.token}`);
      expect(ids(listResponse.body)).toEqual([newer.id, older.id]);
    });

    it('Should return 400 when pinning an unpublished group', async () => {
      const group = await helpGroupFactory.create({ publishedAt: null });
      const response = await asAdmin(
        request(server).post(`${adminRoute}/${group.id}/pin`)
      );
      expect(response.status).toBe(400);
      expect((await helpGroupModel.findByPk(group.id)).pinnedAt).toBeNull();
    });

    it('Should unpin a pinned group when unpublishing it', async () => {
      const group = await helpGroupFactory.create({ pinnedAt: new Date() });
      const response = await asAdmin(
        request(server).post(`${adminRoute}/${group.id}/unpublish`)
      );
      expect(response.status).toBe(200);
      expect(response.body.pinnedAt).toBeNull();
    });
  });

  describe('Soft delete', () => {
    it('Should hide a deleted group everywhere but keep its data', async () => {
      const group = await helpGroupFactory.create();
      await helpGroupMembershipFactory.create({
        groupId: group.id,
        userId: candidate.user.id,
      });
      const discussion = await discussionFactory.create(
        { authorId: candidate.user.id },
        group.id
      );
      const reply = await postReplyFactory.create({
        postId: discussion.id,
        authorId: candidate.user.id,
      });

      const response = await asAdmin(
        request(server).delete(`${adminRoute}/${group.id}`)
      );
      expect(response.status).toBe(204);

      const asCandidate = (path: string) =>
        request(server)
          .get(path)
          .set('authorization', `Bearer ${candidate.token}`);
      expect((await asCandidate(readRoute)).body).toEqual([]);
      expect((await asCandidate(`${readRoute}/${group.slug}`)).status).toBe(
        404
      );
      expect(
        (
          await asCandidate(
            `${readRoute}/${group.slug}/discussions/${discussion.id}/replies`
          )
        ).status
      ).toBe(404);
      // Admins included
      expect(
        (await asAdmin(request(server).get(`${readRoute}/${group.slug}`)))
          .status
      ).toBe(404);

      const dbGroup = await helpGroupModel.findByPk(group.id, {
        paranoid: false,
      });
      expect(dbGroup.deletedAt).not.toBeNull();
      expect(dbGroup.deletedById).toBe(admin.user.id);
      expect(
        await membershipModel.count({ where: { groupId: group.id } })
      ).toBe(1);
      expect(await postModel.findByPk(discussion.id)).not.toBeNull();
      expect(await postReplyModel.findByPk(reply.id)).not.toBeNull();
    });
  });

  describe('Restore', () => {
    it('Should restore a deleted group as unpublished and unpinned', async () => {
      const group = await helpGroupFactory.create({
        pinnedAt: new Date(),
        deletedAt: new Date(),
        deletedById: admin.user.id,
      });

      const response = await asAdmin(
        request(server).post(`${adminRoute}/${group.id}/restore`)
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          deletedAt: null,
          deletedById: null,
          publishedAt: null,
          pinnedAt: null,
        })
      );

      const adminList = await asAdmin(request(server).get(adminRoute));
      expect(ids(adminList.body)).toEqual([group.id]);
      expect(adminList.body[0].publishedAt).toBeNull();

      const pageResponse = await request(server)
        .get(`${readRoute}/${group.slug}`)
        .set('authorization', `Bearer ${candidate.token}`);
      expect(pageResponse.status).toBe(404);
    });

    it('Should keep deleted a reply deleted before the group', async () => {
      const group = await helpGroupFactory.create();
      const discussion = await discussionFactory.create(
        { authorId: candidate.user.id },
        group.id
      );
      const deletedReply = await postReplyFactory.create({
        postId: discussion.id,
        authorId: candidate.user.id,
        deletedAt: new Date(),
      });
      const visibleReply = await postReplyFactory.create({
        postId: discussion.id,
        authorId: candidate.user.id,
      });

      await asAdmin(request(server).delete(`${adminRoute}/${group.id}`));
      await asAdmin(request(server).post(`${adminRoute}/${group.id}/restore`));
      await asAdmin(request(server).post(`${adminRoute}/${group.id}/publish`));

      const repliesResponse = await request(server)
        .get(`${readRoute}/${group.slug}/discussions/${discussion.id}/replies`)
        .set('authorization', `Bearer ${candidate.token}`);
      expect(repliesResponse.status).toBe(200);
      expect(ids(repliesResponse.body.items)).toEqual([visibleReply.id]);
      expect(
        (await postReplyModel.findByPk(deletedReply.id, { paranoid: false }))
          .deletedAt
      ).not.toBeNull();
    });
  });

  describe('Preview', () => {
    it('Should let an admin open an unpublished group page, flagged as unpublished', async () => {
      const group = await helpGroupFactory.create({ publishedAt: null });

      const response = await asAdmin(
        request(server).get(`${readRoute}/${group.slug}`)
      );
      expect(response.status).toBe(200);
      expect(response.body.isPublished).toBe(false);

      const candidateResponse = await request(server)
        .get(`${readRoute}/${group.slug}`)
        .set('authorization', `Bearer ${candidate.token}`);
      expect(candidateResponse.status).toBe(404);
    });
  });

  describe('Admin list', () => {
    it('Should list non deleted groups with their state and counters', async () => {
      const published = await helpGroupFactory.create({
        createdAt: new Date('2026-02-01'),
        pinnedAt: new Date(),
      });
      const unpublished = await helpGroupFactory.create({
        createdAt: new Date('2026-01-01'),
        publishedAt: null,
      });
      await helpGroupFactory.create({ deletedAt: new Date() });

      const deletedUser = await userFactory.create({
        role: UserRoles.COACH,
      });
      await helpGroupMembershipFactory.create({
        groupId: published.id,
        userId: candidate.user.id,
      });
      await helpGroupMembershipFactory.create({
        groupId: published.id,
        userId: deletedUser.id,
      });
      await helpGroupMembershipFactory.create({
        groupId: published.id,
        userId: admin.user.id,
        leftAt: new Date(),
      });
      await userFactory.delete(deletedUser.id);

      const lastActivityAt = new Date('2026-03-01T10:00:00.000Z');
      await discussionFactory.create(
        { authorId: candidate.user.id, lastActivityAt },
        published.id
      );
      await discussionFactory.create(
        {
          authorId: candidate.user.id,
          lastActivityAt: new Date('2026-02-15T10:00:00.000Z'),
        },
        published.id
      );
      await discussionFactory.create(
        {
          authorId: candidate.user.id,
          lastActivityAt: new Date('2026-04-01T10:00:00.000Z'),
          deletedAt: new Date(),
        },
        published.id
      );

      const response = await asAdmin(request(server).get(adminRoute));
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        expect.objectContaining({
          id: published.id,
          name: published.name,
          pinnedAt: expect.any(String),
          publishedAt: expect.any(String),
          membersCount: 1,
          discussionsCount: 2,
          lastActivityAt: lastActivityAt.toISOString(),
        }),
        expect.objectContaining({
          id: unpublished.id,
          publishedAt: null,
          membersCount: 0,
          discussionsCount: 0,
          lastActivityAt: null,
        }),
      ]);
    });

    it('Should list only deleted groups with ?deleted=true', async () => {
      await helpGroupFactory.create();
      const deleted = await helpGroupFactory.create({ deletedAt: new Date() });

      const response = await asAdmin(
        request(server).get(`${adminRoute}?deleted=true`)
      );
      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual([deleted.id]);
      expect(response.body[0].deletedAt).not.toBeNull();
    });
  });
});
