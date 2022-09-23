import { Module } from '@nestjs/common';
import { ContractsModule } from 'src/common/contracts/contracts.module';
import { ContractsHelper } from './contracts.helper';

@Module({
  imports: [ContractsModule],
  providers: [ContractsHelper],
  exports: [ContractsHelper],
})
export class ContractsTestingModule {}
