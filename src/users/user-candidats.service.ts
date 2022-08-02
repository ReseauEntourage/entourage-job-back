import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { WhereOptions } from 'sequelize';
import { UpdateUserCandidatDto } from './dto';
import {
  User,
  UserAttributes,
  UserCandidat,
  UserCandidatAttributes,
} from './models';
import { UserInclude } from './models/user-candidat.include';

@Injectable()
export class UserCandidatsService {
  constructor(
    @InjectModel(UserCandidat)
    private userCandidatModel: typeof UserCandidat
  ) {}

  async create(createUserCandidatDto: Partial<UserCandidat>) {
    return this.userCandidatModel.create(createUserCandidatDto, {
      hooks: true,
    });
  }

  async findOneByCandidateId(candidateId: string) {
    return this.userCandidatModel.findOne({
      where: { candidatId: candidateId },
      attributes: [...UserAttributes],
      include: UserInclude,
    });
  }

  async findOneByCandidateOrCoachId(candidateId?: string, coachId?: string) {
    const findWhere: WhereOptions<UserCandidat> = {};
    if (candidateId) {
      findWhere.candidatId = candidateId;
    }
    if (coachId) {
      findWhere.coachId = coachId;
    }
    return this.userCandidatModel.findOne({
      where: findWhere,
      attributes: [...UserCandidatAttributes],
      include: [
        {
          model: User,
          as: 'coach',
          attributes: [...UserAttributes],
        },
        {
          model: User,
          as: 'candidat',
          attributes: [...UserAttributes],
        },
      ],
    });
  }

  async updateByCandidateId(
    candidateId: string,
    updateUserCandidatDto: UpdateUserCandidatDto
  ) {
    const [updateCount] = await this.userCandidatModel.update(
      updateUserCandidatDto,
      {
        where: { candidatId: candidateId },
        individualHooks: true,
      }
    );

    if (updateCount === 0) {
      return null;
    }

    const updatedUserCandidat = await this.findOneByCandidateId(candidateId);

    return updatedUserCandidat.toJSON();
  }
}
