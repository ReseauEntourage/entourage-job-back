import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Contract } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Contract])],
  providers: [ContractsService],
  controllers: [ContractsController],
  exports: [SequelizeModule],
})
export class ContractsModule {}
