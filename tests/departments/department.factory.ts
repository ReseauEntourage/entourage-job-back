// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as uuid from 'uuid';
import { Department } from 'src/common/departments/models/department.model';
import { Factory } from 'src/utils/types';

@Injectable()
export class DepartmentFactory implements Factory<Department> {
  constructor(
    @InjectModel(Department)
    private department: typeof Department
  ) {}

  generateDepartment(props: Partial<Department>): Partial<Department> {
    const name =
      props.name || faker.lorem.word({ length: { min: 5, max: 10 } });
    return {
      id: uuid.v4(),
      name: name,
      value: props.value || name.slice(0, 3),
    };
  }

  async create(props: Partial<Department> = {}): Promise<Department> {
    const department = this.generateDepartment(props);
    return this.department.create(department);
  }
}
