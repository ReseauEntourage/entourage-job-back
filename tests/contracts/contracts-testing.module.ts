import { Module } from '@nestjs/common';
import { ContractsModule } from 'src/common/contracts/contracts.module';
import { ContractFactory } from './contract.factory';
import { ContractHelper } from './contract.helper';

@Module({
  imports: [ContractsModule],
  providers: [ContractHelper, ContractFactory],
  exports: [ContractHelper],
})
export class ContractsTestingModule {}
