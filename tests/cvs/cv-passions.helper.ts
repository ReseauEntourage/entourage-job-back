import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CVPassion } from 'src/cvs/models';

@Injectable()
export class CVPassionsHelper {
  constructor(
    @InjectModel(CVPassion)
    private cvPassionModel: typeof CVPassion
  ) {}

  async countCVPassionsByCVId(cvId: string) {
    return this.cvPassionModel.count({
      where: {
        CVId: cvId,
      },
    });
  }
}
