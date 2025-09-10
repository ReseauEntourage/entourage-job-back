import { Module } from '@nestjs/common';
import { DepartmentsModule } from 'src/common/departments/departments.module';
import { DepartmentFactory } from './department.factory';
import { DepartmentHelper } from './department.helper';

@Module({
  imports: [DepartmentsModule],
  providers: [DepartmentHelper, DepartmentFactory],
  exports: [DepartmentHelper],
})
export class DepartmentsTestingModule {}
