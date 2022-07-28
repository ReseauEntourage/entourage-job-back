import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UpdateUserCandidatDto } from './dto';
import { UserAttributes, UserCandidat } from './models';
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

  findAll() {
    return `This action returns all users`;
  }

  async findOneByCandidateId(candidateId: string) {
    return this.userCandidatModel.findOne({
      where: { candidatId: candidateId },
      attributes: [...UserAttributes],
      include: UserInclude,
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

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
