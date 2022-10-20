import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Opportunity } from 'src/opportunities/models';

@Injectable()
export class OpportunitiesHelper {
  constructor(
    @InjectModel(Opportunity)
    private opportunityModel: typeof Opportunity
  ) {}

  async findAllOpportunitiesById(opportunityIds: string[]) {
    return this.opportunityModel.findAll({
      where: {
        id: opportunityIds,
      },
    });
  }
}
