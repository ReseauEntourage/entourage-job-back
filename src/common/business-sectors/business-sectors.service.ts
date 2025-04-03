import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { BusinessSector } from 'dist/common/businessSectors/models';
import { searchInColumnWhereOption } from 'src/utils/misc';

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
      order: [['order', 'ASC']],
    });
  }
}
