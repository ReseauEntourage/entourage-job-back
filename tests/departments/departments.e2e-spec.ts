import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { QueuesService } from 'src/queues/producers/queues.service';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { DepartmentHelper } from './department.helper';

describe('Departments', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let departmentHelper: DepartmentHelper;

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
    departmentHelper = moduleFixture.get<DepartmentHelper>(DepartmentHelper);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    await departmentHelper.seedDepartments();
  });

  describe('GET /departments', () => {
    it('should return all departments', async () => {
      const response = await request(server).get(`/departments?&search=`);
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

    it('should return departments filtered by search term', async () => {
      const response = await request(server).get(`/departments?search=Ai`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringContaining('Ai'),
          }),
        ])
      );
    });

    it('should return empty array if no department match search term', async () => {
      const response = await request(server).get(
        `/departments?search=nonexistent`
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});
