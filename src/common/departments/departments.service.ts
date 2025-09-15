import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
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
}
