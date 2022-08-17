import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Contract } from 'src/contracts/models';

@Injectable()
export class ContractsHelper {
  constructor(
    @InjectModel(Contract)
    private contractModel: typeof Contract
  ) {}

  async countContractsByName(names: string | string[]) {
    if (!Array.isArray(names)) {
      names = [names];
    }
    return this.contractModel.count({
      where: {
        name: {
          [Op.or]: names,
        },
      },
    });
  }
}
