import { Injectable } from '@nestjs/common';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

@Injectable()
export class OpportunitiesService {
  create(createOpportunityDto: CreateOpportunityDto) {
    return 'This action adds a new opportunity';
  }

  findAll() {
    return `This action returns all opportunities`;
  }

  findOne(id: number) {
    return `This action returns a #${id} opportunity`;
  }

  update(id: number, updateOpportunityDto: UpdateOpportunityDto) {
    return `This action updates a #${id} opportunity`;
  }

  remove(id: number) {
    return `This action removes a #${id} opportunity`;
  }
}
