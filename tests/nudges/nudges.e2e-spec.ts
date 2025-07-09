import { Server } from 'http';
import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Queues } from 'src/queues/queues.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { CacheMocks, QueueMocks } from 'tests/mocks.types';
import { NudgesHelper } from './nudges.helper';

describe('BusinessSectors', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let nudgesHelper: NudgesHelper;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(QueueMocks)
      .overrideProvider(CACHE_MANAGER)
      .useValue(CacheMocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    nudgesHelper = moduleFixture.get<NudgesHelper>(NudgesHelper);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    await nudgesHelper.seedNudges();
  });

  describe('GET /nudges', () => {
    it('should return all nudges', async () => {
      const response = await request(server).get(
        `/nudges?limit=100&offset=0&search=`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            value: expect.any(String),
            nameRequest: expect.any(String),
            nameOffer: expect.any(String),
            order: expect.any(Number),
          }),
        ])
      );
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return nudges filtered by search term', async () => {
      const response = await request(server).get(
        `/nudges?limit=100&offset=0&search=tips`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            value: expect.stringContaining('tips'),
          }),
        ])
      );
    });

    it('should return empty array if no nudge match search term', async () => {
      const response = await request(server).get(
        `/nudges?limit=100&offset=0&search=nonexistent`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return paginated results', async () => {
      const response = await request(server).get(`/nudges?limit=2&offset=0`);
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });

    it('should return 400 if limit is not provided', async () => {
      const response = await request(server).get(`/nudges?offset=0`);
      expect(response.status).toBe(400);
    });

    it('should return 400 if offset is not provided', async () => {
      const response = await request(server).get(`/nudges?limit=2`);
      expect(response.status).toBe(400);
    });

    it('should return 400 if limit is not a number', async () => {
      const response = await request(server).get(
        `/nudges?limit=invalid&offset=0`
      );
      expect(response.status).toBe(400);
    });

    it('should return 400 if offset is not a number', async () => {
      const response = await request(server).get(
        `/nudges?limit=2&offset=invalid`
      );
      expect(response.status).toBe(400);
    });
  });
});
