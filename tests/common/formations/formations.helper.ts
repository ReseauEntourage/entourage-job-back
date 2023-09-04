import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Formation } from 'src/common/formations/models';

@Injectable()
export class FormationsHelper {
  constructor(
    @InjectModel(Formation)
    private formationModel: typeof Formation
  ) {}

  async countFormationsByCVId(cvId: string) {
    return this.formationModel.count({
      where: {
        CVId: cvId,
      },
    });
  }
}
