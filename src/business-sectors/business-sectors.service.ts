import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { BusinessSector } from './models';

@Injectable()
export class BusinessSectorsService {
  constructor(
    @InjectModel(BusinessSector)
    private businessSectorModel: typeof BusinessSector
  ) {}

  async findAll(limit: number, offset: number, search = '') {
    const whereQuery = searchInColumnWhereOption('BusinessSector.name', search);

    return this.businessSectorModel.findAll({
      where: whereQuery,
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
      order: [['name', 'ASC']],
    });
  }

  async all() {
    return this.businessSectorModel.findAll({
      order: [['name', 'ASC']],
    });
  }
}
