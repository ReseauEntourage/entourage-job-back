import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CV } from 'src/cvs/models';
import path from 'path';

@Injectable()
export class CVsHelper {
  constructor(
    @InjectModel(CV)
    private cvModel: typeof CV
  ) {}

  getTestImagePath() {
    return path.join(process.cwd(), '/tests/testData/imageTest.jpg');
  }

  async findCVsByCandidateId(candidateId: string) {
    return this.cvModel.findAll({
      where: {
        UserId: candidateId,
      },
    });
  }
}
