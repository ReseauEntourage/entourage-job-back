import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { BusinessLine } from 'src/businessLines/models';

@Injectable()
export class BusinessLinesHelper {
  constructor(
    @InjectModel(BusinessLine)
    private businessLineModel: typeof BusinessLine
  ) {}

  async countBusinessLinesByName(names: string | string[]) {
    if (!Array.isArray(names)) {
      names = [names];
    }
    return this.businessLineModel.count({
      where: {
        name: {
          [Op.or]: names,
        },
      },
    });
  }
}
