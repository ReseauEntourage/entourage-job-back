import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Department } from 'src/common/departments/models/department.model';
import { DepartmentCode } from 'src/utils/types/departments.types';
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
        value: DepartmentCode.Ain,
        name: 'Ain',
      },
      {
        value: DepartmentCode.Aisne,
        name: 'Aisne',
      },
      {
        value: DepartmentCode.Allier,
        name: 'Allier',
      },
      {
        value: DepartmentCode.AlpesDeHauteProvence,
        name: 'Alpes-de-Haute-Provence',
      },
      {
        value: DepartmentCode.HautesAlpes,
        name: 'Hautes-Alpes',
      },
      {
        value: DepartmentCode.Paris,
        name: 'Paris',
      },
      {
        value: DepartmentCode.Rhone,
        name: 'Rhône',
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
