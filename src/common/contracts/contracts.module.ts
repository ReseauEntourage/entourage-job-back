import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Contract } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Contract])],
  exports: [SequelizeModule],
})
export class ContractsModule {}
