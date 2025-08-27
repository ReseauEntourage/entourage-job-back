import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Department } from './models/department.model';

@Module({
  imports: [SequelizeModule.forFeature([Department])],
  providers: [],
  exports: [SequelizeModule],
})
export class DepartmentsModule {}
