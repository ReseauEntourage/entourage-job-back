import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Passion } from 'src/common/passions/models';

@Injectable()
export class PassionsHelper {
  constructor(
    @InjectModel(Passion)
    private passionModel: typeof Passion
  ) {}

  async countPassionsByName(names: string | string[]) {
    if (!Array.isArray(names)) {
      names = [names];
    }
    return this.passionModel.count({
      where: {
        name: {
          [Op.or]: names,
        },
      },
    });
  }
}
