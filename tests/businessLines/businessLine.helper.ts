import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { BusinessLine } from 'src/businessLines';

@Injectable()
export class BusinessLineHelper {
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
        [Op.or]: [
          names.map((name) => {
            return { name };
          }),
        ],
      },
    });
  }
}
