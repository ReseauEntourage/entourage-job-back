import { Server } from 'http';
import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Queues } from 'src/queues/queues.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { CacheMocks, QueueMocks } from 'tests/mocks.types';
import { LanguageHelper } from './language.helper';

describe('Languages', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let languageHelper: LanguageHelper;

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
    languageHelper = moduleFixture.get<LanguageHelper>(LanguageHelper);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    await languageHelper.seedLanguages();
  });

  describe('GET /languages', () => {
    it('should return all languages', async () => {
      const response = await request(server).get(
        `/languages?limit=100&offset=0&search=`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            value: expect.any(String),
            name: expect.any(String),
          }),
        ])
      );
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return languages filtered by search term', async () => {
      const response = await request(server).get(
        `/languages?limit=100&offset=0&search=Fran`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringContaining('Fran'),
          }),
        ])
      );
    });

    it('should return empty array if no language match search term', async () => {
      const response = await request(server).get(
        `/languages?limit=100&offset=0&search=nonexistent`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return paginated results', async () => {
      const response = await request(server).get(`/languages?limit=2&offset=0`);
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });

    it('should return 400 if limit is not provided', async () => {
      const response = await request(server).get(`/languages?offset=0`);
      expect(response.status).toBe(400);
    });

    it('should return 400 if offset is not provided', async () => {
      const response = await request(server).get(`/languages?limit=2`);
      expect(response.status).toBe(400);
    });

    it('should return 400 if limit is not a number', async () => {
      const response = await request(server).get(
        `/languages?limit=invalid&offset=0`
      );
      expect(response.status).toBe(400);
    });

    it('should return 400 if offset is not a number', async () => {
      const response = await request(server).get(
        `/languages?limit=2&offset=invalid`
      );
      expect(response.status).toBe(400);
    });
  });
});
