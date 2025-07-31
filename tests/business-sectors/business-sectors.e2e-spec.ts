import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { QueuesService } from 'src/queues/producers/queues.service';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';

describe('BusinessSectors', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let businessSectorsHelper: BusinessSectorHelper;

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
    businessSectorsHelper =
      moduleFixture.get<BusinessSectorHelper>(BusinessSectorHelper);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    await businessSectorsHelper.seedBusinessSectors();
  });

  describe('GET /business-sectors', () => {
    it('should return all business sectors', async () => {
      const response = await request(server).get(
        `/business-sectors?limit=100&offset=0&search=`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            value: expect.any(String),
            prefixes: expect.any(String),
          }),
        ])
      );
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return business sectors filtered by search term', async () => {
      const response = await request(server).get(
        `/business-sectors?limit=100&offset=0&search=1`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringContaining('1'),
          }),
        ])
      );
    });

    it('should return empty array if no business sectors match search term', async () => {
      const response = await request(server).get(
        `/business-sectors?limit=100&offset=0&search=nonexistent`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return paginated results', async () => {
      const response = await request(server).get(
        `/business-sectors?limit=2&offset=0`
      );
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });

    it('should return 400 if limit is not provided', async () => {
      const response = await request(server).get(`/business-sectors?offset=0`);
      expect(response.status).toBe(400);
    });

    it('should return 400 if offset is not provided', async () => {
      const response = await request(server).get(`/business-sectors?limit=2`);
      expect(response.status).toBe(400);
    });

    it('should return 400 if limit is not a number', async () => {
      const response = await request(server).get(
        `/business-sectors?limit=invalid&offset=0`
      );
      expect(response.status).toBe(400);
    });

    it('should return 400 if offset is not a number', async () => {
      const response = await request(server).get(
        `/business-sectors?limit=2&offset=invalid`
      );
      expect(response.status).toBe(400);
    });
  });
});
