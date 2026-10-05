import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import moment from 'moment';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { HelpGroupCard } from 'src/help-groups/help-groups.types';
import { HelpGroup } from 'src/help-groups/models';
import { PostAuthor } from 'src/posts/posts.types';
import { QueuesService } from 'src/queues/producers/queues.service';
import { User } from 'src/users/models';
import { OnboardingStatus, UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { DiscussionFactory } from './discussion.factory';
import { HelpGroupMembershipFactory } from './help-group-membership.factory';
import { HelpGroupFactory } from './help-group.factory';
import { PostReactionFactory } from './post-reaction.factory';
import { PostReplyFactory } from './post-reply.factory';

const ids = (items: { id: string }[]) => items.map(({ id }) => id);

const at = (minutes: number) =>
  moment('2026-09-01T10:00:00.000Z').add(minutes, 'minutes').toDate();

describe('Help groups - Read', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let userFactory: UserFactory;
  let helpGroupFactory: HelpGroupFactory;
  let helpGroupMembershipFactory: HelpGroupMembershipFactory;
  let discussionFactory: DiscussionFactory;
  let postReplyFactory: PostReplyFactory;
  let postReactionFactory: PostReactionFactory;

  const route = '/help-groups';

  let reader: LoggedInUser;
  let admin: LoggedInUser;

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
    helpGroupFactory = moduleFixture.get<HelpGroupFactory>(HelpGroupFactory);
    helpGroupMembershipFactory = moduleFixture.get<HelpGroupMembershipFactory>(
      HelpGroupMembershipFactory
    );
    discussionFactory = moduleFixture.get<DiscussionFactory>(DiscussionFactory);
    postReplyFactory = moduleFixture.get<PostReplyFactory>(PostReplyFactory);
    postReactionFactory =
      moduleFixture.get<PostReactionFactory>(PostReactionFactory);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    reader = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    admin = await usersHelper.createLoggedInUser({ role: UserRoles.ADMIN });
  });

  const get = (path: string, user: LoggedInUser = reader) =>
    request(server).get(path).set('authorization', `Bearer ${user.token}`);

  const createUser = (props: Partial<User> = {}, hasPicture = false) =>
    userFactory.create(
      { role: UserRoles.COACH, ...props },
      { userProfile: { hasPicture } }
    );

  describe('Access', () => {
    it('Should return 401 when not logged in', async () => {
      const group = await helpGroupFactory.create();
      expect((await request(server).get(route)).status).toBe(401);
      expect((await request(server).get(`${route}/${group.slug}`)).status).toBe(
        401
      );
    });

    it('Should open a published group page to a non member', async () => {
      const group = await helpGroupFactory.create({
        description: 'Ligne 1\nLigne 2',
      });
      const response = await get(`${route}/${group.slug}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: group.id,
        slug: group.slug,
        name: group.name,
        description: 'Ligne 1\nLigne 2',
        membersCount: 0,
        isMember: false,
        isPublished: true,
      });
    });

    it.each([
      ['unpublished', { publishedAt: null }],
      ['deleted', { deletedAt: new Date() }],
    ])(
      'Should return 404 to a non admin for an %s group',
      async (_label, props) => {
        const group = await helpGroupFactory.create(props);
        expect((await get(`${route}/${group.slug}`)).status).toBe(404);
        expect((await get(`${route}/${group.slug}/discussions`)).status).toBe(
          404
        );
      }
    );

    it('Should return 404 to an admin for a deleted group', async () => {
      const group = await helpGroupFactory.create({ deletedAt: new Date() });
      expect((await get(`${route}/${group.slug}`, admin)).status).toBe(404);
    });

    it('Should let an admin preview an unpublished group and its discussions', async () => {
      const group = await helpGroupFactory.create({ publishedAt: null });
      const discussion = await discussionFactory.create(
        { authorId: reader.user.id },
        group.id
      );
      const pageResponse = await get(`${route}/${group.slug}`, admin);
      expect(pageResponse.status).toBe(200);
      expect(pageResponse.body.isPublished).toBe(false);

      const discussionResponse = await get(
        `${route}/${group.slug}/discussions/${discussion.id}`,
        admin
      );
      expect(discussionResponse.status).toBe(200);
      expect(discussionResponse.body.group.isPublished).toBe(false);
    });

    it('Should return 404 for an unknown slug', async () => {
      expect((await get(`${route}/inconnu`)).status).toBe(404);
    });
  });

  describe('Catalog', () => {
    it('Should only list published and non deleted groups, also for an admin', async () => {
      const published = await helpGroupFactory.create();
      await helpGroupFactory.create({ publishedAt: null });
      await helpGroupFactory.create({ deletedAt: new Date() });

      expect(ids((await get(route)).body)).toEqual([published.id]);
      expect(ids((await get(route, admin)).body)).toEqual([published.id]);
    });

    it('Should rank pinned groups first (most recently pinned on top), then by creation date', async () => {
      const groups: HelpGroup[] = [];
      for (let i = 0; i < 5; i += 1) {
        groups.push(
          await helpGroupFactory.create({
            createdAt: at(i),
            pinnedAt: i === 0 ? at(100) : i === 2 ? at(50) : null,
          })
        );
      }
      expect(ids((await get(route)).body)).toEqual([
        groups[0].id,
        groups[2].id,
        groups[4].id,
        groups[3].id,
        groups[1].id,
      ]);
    });

    it('Should rank by creation date when no group is pinned', async () => {
      const older = await helpGroupFactory.create({ createdAt: at(0) });
      const newer = await helpGroupFactory.create({ createdAt: at(1) });
      expect(ids((await get(route)).body)).toEqual([newer.id, older.id]);
    });

    it('Should give the card content, without any other counter', async () => {
      const group = await helpGroupFactory.create();
      const member = await createUser();
      await helpGroupMembershipFactory.create({
        groupId: group.id,
        userId: member.id,
      });
      await discussionFactory.create({ authorId: member.id }, group.id);

      const response = await get(route);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: group.id,
          slug: group.slug,
          name: group.name,
          description: group.description,
          membersCount: 1,
          isMember: false,
          pinnedAt: null,
          recentContributors: [
            {
              id: member.id,
              initials:
                `${member.firstName[0]}${member.lastName[0]}`.toUpperCase(),
              hasPicture: false,
            },
          ],
        },
      ]);
    });

    it('Should flag the groups the reader is a member of', async () => {
      const joined = await helpGroupFactory.create({ createdAt: at(1) });
      const notJoined = await helpGroupFactory.create({ createdAt: at(0) });
      const left = await helpGroupFactory.create({ createdAt: at(-1) });
      await helpGroupMembershipFactory.create({
        groupId: joined.id,
        userId: reader.user.id,
      });
      await helpGroupMembershipFactory.create({
        groupId: left.id,
        userId: reader.user.id,
        leftAt: new Date(),
      });

      const response = await get(route);
      expect(
        response.body.map(({ id, isMember, membersCount }: HelpGroupCard) => ({
          id,
          isMember,
          membersCount,
        }))
      ).toEqual([
        { id: joined.id, isMember: true, membersCount: 1 },
        { id: notJoined.id, isMember: false, membersCount: 0 },
        { id: left.id, isMember: false, membersCount: 0 },
      ]);
    });

    it('Should exclude deleted accounts from the members count', async () => {
      const group = await helpGroupFactory.create();
      const deletedMember = await createUser();
      await helpGroupMembershipFactory.create({
        groupId: group.id,
        userId: deletedMember.id,
      });
      await helpGroupMembershipFactory.create({
        groupId: group.id,
        userId: reader.user.id,
      });
      await userFactory.delete(deletedMember.id);

      expect((await get(route)).body[0].membersCount).toBe(1);
      expect((await get(`${route}/${group.slug}`)).body.membersCount).toBe(1);
    });

    it('Should give the 3 most recent distinct contributors, deleted accounts excluded', async () => {
      const group = await helpGroupFactory.create();
      const [first, second, third, fourth, deleted] = await Promise.all([
        createUser(),
        createUser({}, true),
        createUser(),
        createUser(),
        createUser(),
      ]);
      const oldDiscussion = await discussionFactory.create(
        { authorId: first.id, createdAt: at(0) },
        group.id
      );
      await discussionFactory.create(
        { authorId: fourth.id, createdAt: at(1) },
        group.id
      );
      await postReplyFactory.create({
        postId: oldDiscussion.id,
        authorId: third.id,
        createdAt: at(2),
      });
      await discussionFactory.create(
        { authorId: second.id, createdAt: at(3) },
        group.id
      );
      await postReplyFactory.create({
        postId: oldDiscussion.id,
        authorId: first.id,
        createdAt: at(4),
      });
      // Most recent, but by a deleted account
      await discussionFactory.create(
        { authorId: deleted.id, createdAt: at(5) },
        group.id
      );
      // Deleted messages do not count
      await postReplyFactory.create({
        postId: oldDiscussion.id,
        authorId: fourth.id,
        createdAt: at(6),
        deletedAt: new Date(),
      });
      await userFactory.delete(deleted.id);

      const [card] = (await get(route)).body;
      expect(card.recentContributors).toEqual([
        expect.objectContaining({ id: first.id, hasPicture: false }),
        expect.objectContaining({ id: second.id, hasPicture: true }),
        expect.objectContaining({ id: third.id, hasPicture: false }),
      ]);
    });

    it('Should give no contributor for a group without visible discussion', async () => {
      const group = await helpGroupFactory.create();
      await discussionFactory.create(
        { authorId: reader.user.id, deletedAt: new Date() },
        group.id
      );
      expect((await get(route)).body[0].recentContributors).toEqual([]);
    });
  });

  describe('Discussions list', () => {
    let group: HelpGroup;

    beforeEach(async () => {
      group = await helpGroupFactory.create();
    });

    it('Should order discussions by last activity and exclude deleted ones', async () => {
      const old = await discussionFactory.create(
        { authorId: reader.user.id, createdAt: at(0), lastActivityAt: at(10) },
        group.id
      );
      const recent = await discussionFactory.create(
        { authorId: reader.user.id, createdAt: at(5) },
        group.id
      );
      await discussionFactory.create(
        { authorId: reader.user.id, createdAt: at(20), deletedAt: new Date() },
        group.id
      );
      const otherGroup = await helpGroupFactory.create();
      await discussionFactory.create(
        { authorId: reader.user.id, createdAt: at(30) },
        otherGroup.id
      );

      const response = await get(`${route}/${group.slug}/discussions`);
      expect(response.status).toBe(200);
      expect(ids(response.body.items)).toEqual([old.id, recent.id]);
      expect(response.body.nextCursor).toBeNull();
    });

    it('Should paginate with a cursor', async () => {
      const discussions = [];
      for (let i = 0; i < 5; i += 1) {
        discussions.push(
          await discussionFactory.create(
            // Two discussions share the same activity date to check the id tie-break
            { authorId: reader.user.id, createdAt: at(i === 4 ? 3 : i) },
            group.id
          )
        );
      }
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const response = await get(
          `${route}/${group.slug}/discussions?limit=2${
            cursor ? `&cursor=${cursor}` : ''
          }`
        );
        expect(response.status).toBe(200);
        expect(response.body.items.length).toBeLessThanOrEqual(2);
        seen.push(...ids(response.body.items));
        cursor = response.body.nextCursor;
        pages += 1;
      } while (cursor);

      expect(pages).toBe(3);
      expect(new Set(seen).size).toBe(5);
      expect(seen.slice(2)).toEqual(
        expect.arrayContaining([
          discussions[2].id,
          discussions[1].id,
          discussions[0].id,
        ])
      );
      expect(seen.slice(0, 2).sort()).toEqual(
        [discussions[3].id, discussions[4].id].sort()
      );
    });

    it('Should return 400 for an invalid cursor', async () => {
      const response = await get(
        `${route}/${group.slug}/discussions?cursor=invalid`
      );
      expect(response.status).toBe(400);
    });

    it.each(['2abc', '0', '-1', '1.5', 'abc'])(
      'Should return 400 for an invalid limit "%s"',
      async (limit) => {
        const response = await get(
          `${route}/${group.slug}/discussions?limit=${limit}`
        );
        expect(response.status).toBe(400);
      }
    );

    it('Should give the replies count without deleted replies, and reactions without any count', async () => {
      const discussion = await discussionFactory.create(
        { authorId: reader.user.id },
        group.id
      );
      const withoutReply = await discussionFactory.create(
        { authorId: reader.user.id, createdAt: at(-10) },
        group.id
      );
      const amina = await createUser({ firstName: 'Amina' });
      const sofia = await createUser({ firstName: 'Sofia' });
      await postReplyFactory.create({
        postId: discussion.id,
        authorId: amina.id,
      });
      await postReplyFactory.create({
        postId: discussion.id,
        authorId: sofia.id,
      });
      await postReplyFactory.create({
        postId: discussion.id,
        authorId: sofia.id,
        deletedAt: new Date(),
      });
      await postReactionFactory.create({
        userId: amina.id,
        postId: discussion.id,
        emoji: '👏',
      });
      await postReactionFactory.create({
        userId: sofia.id,
        postId: discussion.id,
        emoji: '💪',
      });

      const response = await get(`${route}/${group.slug}/discussions`);
      const [first, second] = response.body.items;
      expect(first).toEqual({
        id: discussion.id,
        title: discussion.title,
        createdAt: expect.any(String),
        lastActivityAt: expect.any(String),
        author: expect.objectContaining({
          id: reader.user.id,
          roleLabel: 'Candidat',
        }),
        repliesCount: 2,
        reactionsSummary: {
          emojis: ['💪', '👏'],
          firstNames: ['Amina', 'Sofia'],
          hasOthers: false,
        },
      });
      expect(second.id).toBe(withoutReply.id);
      expect(second.repliesCount).toBe(0);
      expect(second.reactionsSummary).toBeNull();
      expect(JSON.stringify(response.body)).not.toMatch(/"count"/i);
    });
  });

  describe('Discussion', () => {
    let group: HelpGroup;

    beforeEach(async () => {
      group = await helpGroupFactory.create({ name: 'Refaire un CV' });
    });

    it('Should give the original message, its author card and its group to a non member', async () => {
      const author = await userFactory.create(
        { firstName: 'Julien', lastName: 'Petit', role: UserRoles.CANDIDATE },
        { userProfile: { department: 'Paris (75)' } }
      );
      const discussion = await discussionFactory.create(
        { authorId: author.id, title: 'Mon CV', content: 'Bonjour\nà tous' },
        group.id
      );

      const response = await get(
        `${route}/${group.slug}/discussions/${discussion.id}`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: discussion.id,
        title: 'Mon CV',
        content: 'Bonjour\nà tous',
        createdAt: expect.any(String),
        editedAt: null,
        lastActivityAt: expect.any(String),
        repliesCount: 0,
        reactionsSummary: null,
        author: {
          id: author.id,
          firstName: 'Julien',
          lastNameInitial: 'P.',
          roleLabel: 'Candidat',
          isDeleted: false,
          profileLinkable: true,
          department: 'Paris (75)',
        },
        group: {
          id: group.id,
          slug: group.slug,
          name: 'Refaire un CV',
          isPublished: true,
        },
      });
    });

    it('Should return 404 for a deleted discussion', async () => {
      const discussion = await discussionFactory.create(
        { authorId: reader.user.id, deletedAt: new Date() },
        group.id
      );
      expect(
        (await get(`${route}/${group.slug}/discussions/${discussion.id}`))
          .status
      ).toBe(404);
    });

    it('Should return 404 for a discussion under another group slug', async () => {
      const otherGroup = await helpGroupFactory.create();
      const discussion = await discussionFactory.create(
        { authorId: reader.user.id },
        otherGroup.id
      );
      expect(
        (await get(`${route}/${group.slug}/discussions/${discussion.id}`))
          .status
      ).toBe(404);
      expect(
        (
          await get(
            `${route}/${group.slug}/discussions/${discussion.id}/replies`
          )
        ).status
      ).toBe(404);
    });

    it('Should return 404 for an unknown or malformed discussion id', async () => {
      expect(
        (await get(`${route}/${group.slug}/discussions/${uuid()}`)).status
      ).toBe(404);
      expect(
        (await get(`${route}/${group.slug}/discussions/not-a-uuid`)).status
      ).toBe(404);
    });

    it('Should label every role, admins as « Équipe Entourage »', async () => {
      const discussion = await discussionFactory.create(
        { authorId: reader.user.id },
        group.id
      );
      const coach = await createUser({
        firstName: 'Amina',
        lastName: 'Lefèvre',
      });
      const referer = await createUser({ role: UserRoles.REFERER });
      for (const [i, authorId] of [
        coach.id,
        referer.id,
        admin.user.id,
      ].entries()) {
        await postReplyFactory.create({
          postId: discussion.id,
          authorId,
          createdAt: at(i),
        });
      }

      const response = await get(
        `${route}/${group.slug}/discussions/${discussion.id}/replies`
      );
      expect(
        response.body.items.map(({ author }: { author: PostAuthor }) => author)
      ).toEqual([
        {
          id: coach.id,
          firstName: 'Amina',
          lastNameInitial: 'L.',
          roleLabel: 'Coach',
          isDeleted: false,
          profileLinkable: true,
        },
        expect.objectContaining({ roleLabel: 'Prescripteur' }),
        expect.objectContaining({
          roleLabel: 'Équipe Entourage',
          profileLinkable: false,
        }),
      ]);
    });

    it('Should not link a profile which is not viewable by the reader, except for an admin reader', async () => {
      const notEligible = await createUser({
        onboardingStatus: OnboardingStatus.IN_PROGRESS,
      });
      const discussion = await discussionFactory.create(
        { authorId: notEligible.id },
        group.id
      );

      const response = await get(
        `${route}/${group.slug}/discussions/${discussion.id}`
      );
      expect(response.body.author.profileLinkable).toBe(false);
      expect(response.body.author.department).toBeUndefined();

      const adminResponse = await get(
        `${route}/${group.slug}/discussions/${discussion.id}`,
        admin
      );
      expect(adminResponse.body.author.profileLinkable).toBe(true);
    });

    it('Should keep messages of a deleted account without identity', async () => {
      const deletedAuthor = await createUser();
      const discussion = await discussionFactory.create(
        { authorId: deletedAuthor.id },
        group.id
      );
      await postReplyFactory.create({
        postId: discussion.id,
        authorId: deletedAuthor.id,
      });
      await userFactory.delete(deletedAuthor.id);

      const expectedAuthor = {
        id: deletedAuthor.id,
        firstName: null as string | null,
        lastNameInitial: null as string | null,
        roleLabel: null as string | null,
        isDeleted: true,
        profileLinkable: false,
      };

      const discussionResponse = await get(
        `${route}/${group.slug}/discussions/${discussion.id}`
      );
      expect(discussionResponse.status).toBe(200);
      expect(discussionResponse.body.author).toEqual(expectedAuthor);

      const repliesResponse = await get(
        `${route}/${group.slug}/discussions/${discussion.id}/replies`
      );
      expect(repliesResponse.body.items).toHaveLength(1);
      expect(repliesResponse.body.items[0].author).toEqual(expectedAuthor);

      const listResponse = await get(`${route}/${group.slug}/discussions`);
      expect(listResponse.body.items[0].author).toEqual(expectedAuthor);
    });

    it('Should ignore reactions of deleted accounts', async () => {
      const discussion = await discussionFactory.create(
        { authorId: reader.user.id },
        group.id
      );
      const deletedUser = await createUser();
      await postReactionFactory.create({
        userId: deletedUser.id,
        postId: discussion.id,
      });
      await userFactory.delete(deletedUser.id);

      const response = await get(
        `${route}/${group.slug}/discussions/${discussion.id}`
      );
      expect(response.body.reactionsSummary).toBeNull();
    });

    it('Should give 3 first names and hasOthers beyond 3 reacting people, in reaction order', async () => {
      const discussion = await discussionFactory.create(
        { authorId: reader.user.id },
        group.id
      );
      const firstNames = ['Amina', 'Sofia', 'Malik', 'Julien', 'Nora'];
      const emojis = ['🎉', '💪', '🎉', '❤️', '💪'] as const;
      for (const [i, firstName] of firstNames.entries()) {
        const user = await createUser({ firstName });
        await postReactionFactory.create({
          userId: user.id,
          postId: discussion.id,
          emoji: emojis[i],
          createdAt: at(i),
        });
      }

      const response = await get(
        `${route}/${group.slug}/discussions/${discussion.id}`
      );
      expect(response.body.reactionsSummary).toEqual({
        emojis: ['💪', '❤️', '🎉'],
        firstNames: ['Amina', 'Sofia', 'Malik'],
        hasOthers: true,
      });
    });

    it('Should give replies oldest first, paginated, without deleted ones, with their reactions', async () => {
      const discussion = await discussionFactory.create(
        { authorId: reader.user.id },
        group.id
      );
      const replies = [];
      for (let i = 0; i < 4; i += 1) {
        replies.push(
          await postReplyFactory.create({
            postId: discussion.id,
            authorId: reader.user.id,
            createdAt: at(i),
            deletedAt: i === 1 ? new Date() : undefined,
          })
        );
      }
      const julien = await createUser({ firstName: 'Julien' });
      await postReactionFactory.create({
        userId: julien.id,
        replyId: replies[0].id,
        emoji: '👏',
      });

      const firstPage = await get(
        `${route}/${group.slug}/discussions/${discussion.id}/replies?limit=2`
      );
      expect(firstPage.status).toBe(200);
      expect(ids(firstPage.body.items)).toEqual([replies[0].id, replies[2].id]);
      expect(firstPage.body.items[0].reactionsSummary).toEqual({
        emojis: ['👏'],
        firstNames: ['Julien'],
        hasOthers: false,
      });
      expect(firstPage.body.items[1].reactionsSummary).toBeNull();

      const secondPage = await get(
        `${route}/${group.slug}/discussions/${discussion.id}/replies?limit=2&after=${firstPage.body.nextCursor}`
      );
      expect(ids(secondPage.body.items)).toEqual([replies[3].id]);
      expect(secondPage.body.nextCursor).toBeNull();

      const discussionResponse = await get(
        `${route}/${group.slug}/discussions/${discussion.id}`
      );
      expect(discussionResponse.body.repliesCount).toBe(3);
    });

    it('Should never expose a full last name nor an email', async () => {
      const author = await createUser({
        firstName: 'Julien',
        lastName: 'Patronymelong',
        email: 'julien.patronymelong@example.com',
      });
      const discussion = await discussionFactory.create(
        { authorId: author.id },
        group.id
      );
      await postReplyFactory.create({
        postId: discussion.id,
        authorId: author.id,
      });
      await postReactionFactory.create({
        userId: author.id,
        postId: discussion.id,
      });

      const bodies = await Promise.all(
        [
          route,
          `${route}/${group.slug}`,
          `${route}/${group.slug}/discussions`,
          `${route}/${group.slug}/discussions/${discussion.id}`,
          `${route}/${group.slug}/discussions/${discussion.id}/replies`,
        ].map(async (path) => JSON.stringify((await get(path)).body))
      );
      for (const body of bodies) {
        expect(body).not.toContain('Patronymelong');
        expect(body).not.toContain('@example.com');
        expect(body).not.toMatch(/"(lastName|email)"/);
      }
    });
  });
});
