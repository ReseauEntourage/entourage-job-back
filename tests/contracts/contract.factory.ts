import { randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Contract } from 'src/contracts/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class ContractFactory implements Factory<Contract> {
  constructor(
    @InjectModel(Contract)
    private contractModel: typeof Contract
  ) {}

  generateContract(props: Partial<Contract>): Partial<Contract> {
    return {
      id: randomUUID(),
      name: props.name || faker.lorem.word({ length: { min: 5, max: 10 } }),
    };
  }

  async create(props: Partial<Contract> = {}): Promise<Contract> {
    const contract = this.generateContract(props);
    return this.contractModel.create(contract);
  }
}
