import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { v4 as uuid } from 'uuid';
import { QueueMocks, S3Mocks } from '../mocks.types';
import { CommunicationLogsModule } from 'src/communication-logs/communication-logs.module';
import { CommunicationLogsService } from 'src/communication-logs/communication-logs.service';
import { CommunicationChannels } from 'src/communication-logs/communication-logs.types';
import { CommunicationLog } from 'src/communication-logs/models';
import { S3Service } from 'src/external-services/aws/s3.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { UsersDeletionService } from 'src/users-deletion/users-deletion.service';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

describe('CommunicationLogs', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;

  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let service: CommunicationLogsService;
  let communicationLogModel: typeof CommunicationLog;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [CustomTestingModule, CommunicationLogsModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(S3Service)
      .useValue(S3Mocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    service = moduleFixture.get(CommunicationLogsService);
    communicationLogModel = moduleFixture.get(getModelToken(CommunicationLog));
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    await communicationLogModel.destroy({ where: {} });
  });

  afterAll(async () => {
    await communicationLogModel.destroy({ where: {} });
    await databaseHelper.resetTestDB();
    await app.close();
    if (QueueMocks.close) {
      await QueueMocks.close();
    }
  });

  it('records one row per accepted communication and reads them back', async () => {
    const userId = uuid();
    const authorId = uuid();

    await service.recordSent([
      {
        userId,
        channel: CommunicationChannels.EMAIL,
        type: 'ACCOUNT_CREATED',
      },
      {
        userId,
        channel: CommunicationChannels.SMS,
        type: 'UNANSWERED_CONVERSATION_REMINDER',
        metadata: { senderId: authorId },
      },
    ]);

    const rows = await communicationLogModel.findAll({
      where: { userId },
      order: [['channel', 'ASC']],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        channel: 'email',
        type: 'ACCOUNT_CREATED',
        metadata: null,
      })
    );
    expect(rows[0].sentAt).toBeInstanceOf(Date);
    expect(rows[1]).toEqual(
      expect.objectContaining({
        channel: 'sms',
        type: 'UNANSWERED_CONVERSATION_REMINDER',
        metadata: { senderId: authorId },
      })
    );
  });

  it('records nothing for an empty list', async () => {
    await service.recordSent([]);

    expect(await communicationLogModel.count()).toBe(0);
  });

  it('never throws when the rows cannot be written', async () => {
    await expect(
      service.recordSent([
        {
          userId: 'not-a-uuid',
          channel: CommunicationChannels.EMAIL,
          type: 'ACCOUNT_CREATED',
        },
      ])
    ).resolves.toBeUndefined();

    expect(await communicationLogModel.count()).toBe(0);
  });

  it('keeps the rows of a user once the account is deleted', async () => {
    const user = await userFactory.create({ role: UserRoles.CANDIDATE });
    await service.recordSent([
      {
        userId: user.id,
        channel: CommunicationChannels.EMAIL,
        type: 'ACCOUNT_CREATED',
      },
    ]);

    const { userDeleted } = await moduleFixture
      .get(UsersDeletionService)
      .deleteCompleteUser(user as Pick<User, 'id' | 'firstName' | 'lastName'>);

    expect(userDeleted).toBe(1);
    const rows = await communicationLogModel.findAll({
      where: { userId: user.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('ACCOUNT_CREATED');
  });
});
