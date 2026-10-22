import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { Jobs } from 'src/queues/queues.types';
import { Genders } from 'src/users/users.types';

// Pure unit test (no database): the work queue is stubbed.
describe('ExternalDatabasesService', () => {
  const addToWorkQueue = jest.fn();
  const service = new ExternalDatabasesService({ addToWorkQueue } as never);

  beforeEach(() => addToWorkQueue.mockReset().mockResolvedValue(undefined));

  describe('createExternalDBUser', () => {
    it.each([
      [Genders.MALE, 'male'],
      [Genders.FEMALE, 'female'],
      [Genders.OTHER, 'other'],
      [undefined, null],
    ])('converts the gender %s to %s', async (gender, expected) => {
      await service.createExternalDBUser('user-1', {
        gender,
        refererId: 'ref-1',
      } as never);

      expect(addToWorkQueue).toHaveBeenCalledWith(
        Jobs.CREATE_OR_UPDATE_SALESFORCE_USER,
        { userId: 'user-1', gender: expected, refererId: 'ref-1' }
      );
    });

    it('rejects an invalid gender without queueing anything', async () => {
      await expect(
        service.createExternalDBUser('user-1', { gender: 42 } as never)
      ).rejects.toThrow('Invalid gender value');
      expect(addToWorkQueue).not.toHaveBeenCalled();
    });
  });

  it('queues the social situation update, never as a company admin', async () => {
    await service.updateExternalDBUserSocialSituation('user-1', {
      nationality: 'french',
    } as never);

    expect(addToWorkQueue).toHaveBeenCalledWith(
      Jobs.CREATE_OR_UPDATE_SALESFORCE_USER,
      { userId: 'user-1', nationality: 'french', isCompanyAdmin: false }
    );
  });

  it('queues the company creation or update', async () => {
    await service.createOrUpdateExternalDBCompany('Acme', {
      department: 'Paris (75)',
      userId: 'user-1',
    });

    expect(addToWorkQueue).toHaveBeenCalledWith(
      Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY,
      { name: 'Acme', department: 'Paris (75)', userId: 'user-1' }
    );
  });

  it('queues the link or unlink of a user and a company', async () => {
    await service.updateUserCompanyExternalDBCompany('user-1', 'company-1');
    await service.updateUserCompanyExternalDBCompany('user-1', null);

    expect(addToWorkQueue).toHaveBeenNthCalledWith(
      1,
      Jobs.UPDATE_SALESFORCE_USER_COMPANY,
      { userId: 'user-1', companyId: 'company-1' }
    );
    expect(addToWorkQueue).toHaveBeenNthCalledWith(
      2,
      Jobs.UPDATE_SALESFORCE_USER_COMPANY,
      { userId: 'user-1', companyId: null }
    );
  });
});
