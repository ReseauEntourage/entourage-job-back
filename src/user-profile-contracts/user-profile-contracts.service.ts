import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op } from 'sequelize';
import { Contract } from 'src/contracts/models';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileContract } from 'src/user-profiles/models/user-profile-contract.model';

@Injectable()
export class UserProfileContractsService {
  constructor(
    @InjectModel(Contract)
    private contractModel: typeof Contract,
    @InjectModel(UserProfileContract)
    private userProfileContractModel: typeof UserProfileContract
  ) {}

  async findContractByUserProfileId(userProfileId: string) {
    return this.contractModel.findAll({
      attributes: ['id', 'name'],
      include: [
        {
          model: UserProfileContract,
          as: 'userProfileContracts',
          where: { userProfileId },
          required: true,
          attributes: ['id'],
        },
      ],
    });
  }

  async updateContractsByUserProfileId(
    userProfileToUpdate: UserProfile,
    contracts: Partial<Contract>[],
    t: sequelize.Transaction
  ): Promise<void> {
    const contractsData = contracts.map((contract) => {
      return {
        userProfileId: userProfileToUpdate.id,
        contractId: contract.id,
      };
    });
    const userProfileContracts = await this.userProfileContractModel.bulkCreate(
      contractsData,
      {
        hooks: true,
        transaction: t,
      }
    );
    await this.userProfileContractModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: userProfileContracts.map((upContract) => upContract.id),
        },
      },
      individualHooks: true,
      transaction: t,
    });
  }
}
