import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UsersService } from 'src/users/users.service';
import { UpdateOpportunityUserDto } from './dto/update-opportunity-user.dto';
import { OpportunityUser } from './models';
import { OpportunityCandidateInclude } from './models/opportunity.include';

@Injectable()
export class OpportunityUsersService {
  constructor(
    @InjectModel(OpportunityUser)
    private opportunityUserModel: typeof OpportunityUser,
    private usersService: UsersService
  ) {}

  async create(createOpportunityUserDto: Partial<OpportunityUser>) {
    return this.opportunityUserModel.create(createOpportunityUserDto, {
      hooks: true,
    });
  }

  async findOneByCandidateIdAndOpportunityId(
    candidateId: string,
    opportunityId: string
  ) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    return this.opportunityUserModel.findOne({
      where: {
        UserId: candidateId,
        OpportunityId: opportunityId,
      },
      include: OpportunityCandidateInclude,
    });
  }

  async findAllByCandidateId(candidateId: string) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    return this.opportunityUserModel.findAll({
      where: {
        UserId: candidateId,
      },
    });
  }

  async findAllByCandidatesIdsAndOpportunityId(
    candidatesIds: string[],
    opportunityId: string
  ) {
    return this.opportunityUserModel.findAll({
      where: {
        UserId: candidatesIds,
        OpportunityId: opportunityId,
      },
      include: OpportunityCandidateInclude,
    });
  }

  async updateByCandidateId(
    candidateId: string,
    updateOpportunityUserDto: UpdateOpportunityUserDto
  ) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    await this.opportunityUserModel.update(updateOpportunityUserDto, {
      where: {
        UserId: candidateId,
      },
      individualHooks: true,
    });

    return this.findAllByCandidateId(candidateId);
  }

  async updateByCandidateIdAndOpportunityId(
    candidateId: string,
    opportunityId: string,
    updateOpportunityUserDto: UpdateOpportunityUserDto
  ) {
    const candidate = await this.usersService.findOne(candidateId);

    if (!candidate) {
      return null;
    }

    await this.opportunityUserModel.update(updateOpportunityUserDto, {
      where: {
        UserId: candidateId,
        OpportunityId: opportunityId,
      },
      individualHooks: true,
    });

    return this.findOneByCandidateIdAndOpportunityId(
      candidateId,
      opportunityId
    );
  }

  async findOrCreate(opportunityId: string, userId: string) {
    const [opportunityUser] = await this.opportunityUserModel.findOrCreate({
      where: {
        OpportunityId: opportunityId,
        UserId: userId,
        recommended: true,
      },
    });
    return opportunityUser;
  }
}
