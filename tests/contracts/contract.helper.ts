import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Contract } from 'src/common/contracts/models';
import { ContractFactory } from './contract.factory';

@Injectable()
export class ContractHelper {
  constructor(
    @InjectModel(Contract)
    private contractModel: typeof Contract,
    private contractFactory: ContractFactory
  ) {}

  async findOne({ name }: { name: string }) {
    return this.contractModel.findOne({
      where: { name },
    });
  }

  async deleteAllContracts() {
    try {
      await this.contractModel.destroy({
        where: {},
        force: true,
      });
    } catch (err) {
      console.error('Error deleting contracts:', err);
      throw err;
    }
  }

  async seedContracts() {
    const contracts = [
      {
        name: 'Alternance',
      },
      {
        name: 'CDD',
      },
      {
        name: 'CDI',
      },
    ];

    try {
      for (const contract of contracts) {
        await this.contractFactory.create({
          name: contract.name,
        });
      }
    } catch (err) {
      console.error('Error seeding contracts:', err);
    }
  }
}
