import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { WhereOptions } from 'sequelize';
import Transaction from 'sequelize/types/transaction';
import { UpdateUserCandidatDto } from 'src/users/dto';
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

  async findOneByCandidateId(candidateId: string, transaction?: Transaction) {
    const transactionOption = transaction ? { transaction } : {};
    return this.userCandidatModel.findOne({
      where: { candidatId: candidateId },
      attributes: [...UserCandidatAttributes],
      include: UserInclude,
      ...transactionOption,
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

  async findAllByCoachId(coachId?: string) {
    return this.userCandidatModel.findAll({
      where: { coachId },
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

  async findAllById(usersIds: string[]) {
    return this.userCandidatModel.findAll({
      where: {
        id: usersIds,
      },
    });
  }

  async updateByCandidateId(
    candidateId: string,
    updateUserCandidatDto: Partial<UserCandidat>
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

  async updateAllLinkedCoachesByCandidatesIds(
    candidatesAndCoachesIds: { candidateId: string; coachId: string }[]
  ): Promise<UserCandidat[]> {
    const t = await this.userCandidatModel.sequelize.transaction();

    try {
      const updatedUserCandidates = await Promise.all(
        candidatesAndCoachesIds.map(async ({ candidateId, coachId }) => {
          await this.userCandidatModel.update(
            {
              coachId: coachId,
            },
            {
              where: { candidatId: candidateId },
              individualHooks: true,
              transaction: t,
            }
          );

          const updatedUserCandidat = await this.findOneByCandidateId(
            candidateId,
            t
          );

          if (!updatedUserCandidat) {
            return null;
          }
          return updatedUserCandidat;
        })
      );
      if (updatedUserCandidates.includes(null)) {
        await t.rollback();
        return null;
      }
      await t.commit();
      return updatedUserCandidates;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async updateAll(usersIds: string[], attributes: UpdateUserCandidatDto) {
    const [nbUpdated, updatedUserCandidats] =
      await this.userCandidatModel.update(attributes, {
        where: { candidatId: usersIds },
        returning: true,
        individualHooks: true,
      });
    return {
      nbUpdated,
      updatedUserCandidats: updatedUserCandidats,
    };
  }
}
