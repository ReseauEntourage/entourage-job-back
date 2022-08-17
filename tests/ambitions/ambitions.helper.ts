import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Ambition } from 'src/ambitions/models';

@Injectable()
export class AmbitionsHelper {
  constructor(
    @InjectModel(Ambition)
    private ambitionModel: typeof Ambition
  ) {}

  async countAmbitionsByName(names: string | string[]) {
    if (!Array.isArray(names)) {
      names = [names];
    }
    return this.ambitionModel.count({
      where: {
        name: {
          [Op.or]: names,
        },
      },
    });
  }
}
