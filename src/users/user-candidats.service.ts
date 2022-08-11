import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { WhereOptions } from 'sequelize';
import { UpdateUserCandidatDto } from './dto';
import { UserCandidat, UserCandidatAttributes } from './models';
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
      attributes: [...UserCandidatAttributes],
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
      include: UserInclude,
    });
  }

  async findOneByUrl(url: string) {
    return this.userCandidatModel.findOne({
      where: {
        url,
      },
    });
  }

  async updateByCandidateId(
    candidateId: string,
    updateUserCandidatDto: UpdateUserCandidatDto
  ): Promise<UserCandidat> {
    await this.userCandidatModel.update(updateUserCandidatDto, {
      where: { candidatId: candidateId },
      individualHooks: true,
    });

    const updatedUserCandidat = await this.findOneByCandidateId(candidateId);

    if (!updatedUserCandidat) {
      return null;
    }
    return updatedUserCandidat.toJSON();
  }

  async checkNoteHasBeenModified(candidateId: string, userId: string) {
    const userCandidat = await this.userCandidatModel.findOne({
      where: { candidatId: candidateId },
      attributes: ['lastModifiedBy'],
    });

    return {
      noteHasBeenModified: userCandidat
        ? !!userCandidat.lastModifiedBy &&
          userCandidat.lastModifiedBy !== userId
        : false,
    };
  }
}
