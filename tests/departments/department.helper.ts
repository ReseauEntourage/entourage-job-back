import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Department } from 'src/common/departments/models/department.model';
import { DepartmentFactory } from './department.factory';

@Injectable()
export class DepartmentHelper {
  constructor(
    @InjectModel(Department)
    private departmentModel: typeof Department,
    private departmentFactory: DepartmentFactory
  ) {}

  async findOne({ value }: { value: string }) {
    return this.departmentModel.findOne({
      where: { value },
    });
  }

  async deleteAllDepartments() {
    try {
      await this.departmentModel.destroy({
        where: {},
        force: true,
      });
    } catch (err) {
      console.error('Error deleting departments:', err);
      throw err;
    }
  }

  async seedDepartments() {
    const departments = [
      {
        value: '01',
        name: 'Ain',
      },
      {
        value: '02',
        name: 'Aisne',
      },
      {
        value: '03',
        name: 'Allier',
      },
      {
        value: '04',
        name: 'Alpes-de-Haute-Provence',
      },
      {
        value: '05',
        name: 'Hautes-Alpes',
      },
    ];

    try {
      for (const department of departments) {
        await this.departmentFactory.create({
          name: department.name,
          value: department.value,
        });
      }
    } catch (err) {
      console.error('Error seeding languages:', err);
    }
  }
}
