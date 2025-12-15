import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Department as DepartmentName } from 'src/common/locations/locations.types';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { Department } from './models/department.model';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department)
    private departmentModel: typeof Department
  ) {}

  async findAll(search = '') {
    const whereQuery = {
      [Op.or]: [
        searchInColumnWhereOption('Department.name', search),
        searchInColumnWhereOption('Department.value', search),
      ],
    };

    return this.departmentModel.findAll({
      where: whereQuery,
      order: [['value', 'ASC']],
    });
  }

  async all() {
    return this.departmentModel.findAll({
      order: [['name', 'ASC']],
    });
  }

  async findOne(id: string) {
    return this.departmentModel.findByPk(id);
  }

  async mapDepartmentsIdsToFormattedNames(departmentIds: string[]) {
    if (departmentIds.length === 0) {
      return [];
    }
    const departments = await this.departmentModel.findAll({
      where: {
        id: {
          [Op.in]: departmentIds,
        },
      },
    });

    return departments.map(
      (department) => `${department.name} (${department.value})`
    ) as DepartmentName[];
  }
}
