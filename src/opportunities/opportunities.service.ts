import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { Opportunity } from './models';
import { OpportunityCompleteInclude } from './models/opportunity.include';

@Injectable()
export class OpportunitiesService {
  constructor(
    @InjectModel(Opportunity) private opportunityModel: typeof Opportunity
  ) {}

  create(createOpportunityDto: CreateOpportunityDto) {
    return 'This action adds a new opportunity';
  }

  findAll() {
    return `This action returns all opportunities`;
  }

  async findOne(id: string) {
    return this.opportunityModel.findByPk(id, {
      include: OpportunityCompleteInclude,
    });
  }

  update(id: number, updateOpportunityDto: UpdateOpportunityDto) {
    return `This action updates a #${id} opportunity`;
  }

  remove(id: number) {
    return `This action removes a #${id} opportunity`;
  }
}
