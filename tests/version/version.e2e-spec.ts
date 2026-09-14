import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { QueuesService } from 'src/queues/producers/queues.service';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';

describe('Version', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;

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
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  describe('GET /version', () => {
    it('should return the app version and release without authentication', async () => {
      const response = await request(server).get('/version');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          version: expect.any(String),
        })
      );
      expect(response.body.version.length).toBeGreaterThan(0);
      expect(
        response.body.release === null ||
          typeof response.body.release === 'string'
      ).toBe(true);
    });
  });
});
