import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { Nudge } from './models';

@Injectable()
export class NudgesService {
  constructor(
    @InjectModel(Nudge)
    private nudgeModel: typeof Nudge
  ) {}

  async findAll(limit: number, offset: number, search = '') {
    const whereQuery = searchInColumnWhereOption('Nudge.value', search);

    return this.nudgeModel.findAll({
      where: whereQuery,
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
      order: [['order', 'ASC']],
    });
  }
}
