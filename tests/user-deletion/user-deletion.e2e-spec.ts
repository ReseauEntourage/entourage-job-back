/* eslint-disable no-console */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { QueueMocks, S3Mocks } from '../mocks.types';
import { UserProfilesHelper } from '../user-profiles/user-profiles.helper';
import { LoggedUser } from 'src/auth/auth.types';
import { S3Service } from 'src/external-services/aws/s3.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { UsersDeletionController } from 'src/users-deletion/users-deletion.controller';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';

describe('UserDeletion', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;
  let userProfilesHelper: UserProfilesHelper;

  const route = '/user';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(S3Service)
      .useValue(S3Mocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    userProfilesHelper =
      moduleFixture.get<UserProfilesHelper>(UserProfilesHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
  });

  beforeAll(async () => {
    // Reset the test database
    await databaseHelper.resetTestDB();
  });

  afterAll(async () => {
    // Fermeture de l'application NestJS
    await app.close();

    // Fermeture du serveur HTTP avec une Promise
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log('Serveur HTTP fermé');
        resolve();
      });
    });

    // Fermeture des files d'attente
    if (QueueMocks.close) {
      await QueueMocks.close();
      console.log("Files d'attente fermées");
    }

    console.log('Toutes les connexions ont été fermées');
  });

  beforeEach(async () => {
    try {
      await databaseHelper.resetTestDB();
    } catch (error) {
      console.error(
        'Erreur lors de la réinitialisation de la base de données:',
        error
      );
      throw error;
    }
  });

  describe('DELETE user/:id - Delete user and all associated dto', () => {
    let loggedInAdmin: LoggedUser;
    let loggedInCoach: LoggedUser;
    let loggedInReferer: LoggedUser;
    let candidate: User;
    let coach: User;
    let referer: User;

    beforeEach(async () => {
      loggedInAdmin = await usersHelper.createLoggedInUser({
        role: UserRoles.ADMIN,
      });

      candidate = await userFactory.create({
        role: UserRoles.CANDIDATE,
      });

      coach = await userFactory.create({
        role: UserRoles.COACH,
      });

      referer = await userFactory.create({
        role: UserRoles.REFERER,
      });

      loggedInCoach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });

      loggedInReferer = await usersHelper.createLoggedInUser({
        role: UserRoles.REFERER,
      });
    });
    it('Should return 403 if logged as coach', async () => {
      const response: APIResponse<UsersDeletionController['removeUser']> =
        await request(server)
          .delete(`${route}/${candidate.id}`)
          .set('authorization', `Bearer ${loggedInCoach.token}`);
      expect(response.status).toBe(403);
    });

    it('Should return 403 if logged as referer', async () => {
      const response: APIResponse<UsersDeletionController['removeUser']> =
        await request(server)
          .delete(`${route}/${candidate.id}`)
          .set('authorization', `Bearer ${loggedInReferer.token}`);
      expect(response.status).toBe(403);
    });
    it('Should return 200 if logged in as admin and deletes candidate', async () => {
      const response: APIResponse<UsersDeletionController['removeUser']> =
        await request(server)
          .delete(`${route}/${candidate.id}`)
          .set('authorization', `Bearer ${loggedInAdmin.token}`);

      expect(response.status).toBe(200);
      expect(response.body.userDeleted).toBe(1);

      const user = await usersHelper.findUser(candidate.id);
      expect(user).toBeFalsy();
      const userProfile = await userProfilesHelper.findOneProfileByUserId(
        candidate.id
      );
      expect(userProfile).toBeFalsy();
    });
    it('Should return 200 if logged in as admin and deletes coach', async () => {
      const response: APIResponse<UsersDeletionController['removeUser']> =
        await request(server)
          .delete(`${route}/${coach.id}`)
          .set('authorization', `Bearer ${loggedInAdmin.token}`);

      expect(response.status).toBe(200);
      expect(response.body.userDeleted).toBe(1);

      const user = await usersHelper.findUser(coach.id);
      expect(user).toBeFalsy();

      const userProfile = await userProfilesHelper.findOneProfileByUserId(
        coach.id
      );
      expect(userProfile).toBeFalsy();
    });

    it('Should return 200 if logged in as admin and deletes referer', async () => {
      const response: APIResponse<UsersDeletionController['removeUser']> =
        await request(server)
          .delete(`${route}/${referer.id}`)
          .set('authorization', `Bearer ${loggedInAdmin.token}`);

      expect(response.status).toBe(200);
      expect(response.body.userDeleted).toBe(1);

      const user = await usersHelper.findUser(referer.id);
      expect(user).toBeFalsy();

      const userProfile = await userProfilesHelper.findOneProfileByUserId(
        referer.id
      );
      expect(userProfile).toBeFalsy();
    });
  });
});
