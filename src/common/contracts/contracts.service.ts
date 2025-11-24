import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserProfileContract } from 'src/user-profiles/models/user-profile-contract.model';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { Contract } from './models';

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract)
    private contractModel: typeof Contract
  ) {}

  async findAll(limit: number, offset: number, search = '') {
    const whereQuery = searchInColumnWhereOption('Contract.name', search);

    return this.contractModel.findAll({
      where: whereQuery,
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
      order: [['name', 'ASC']],
    });
  }

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
}
