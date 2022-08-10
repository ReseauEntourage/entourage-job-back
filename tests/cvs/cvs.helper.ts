import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CV } from 'src/cvs/models';

@Injectable()
export class CVsHelper {
  constructor(
    @InjectModel(CV)
    private cvModel: typeof CV
  ) {}

  async findCVsByCandidateId(candidateId: string) {
    return this.cvModel.findAll({
      where: {
        UserId: candidateId,
      },
    });
  }
}
