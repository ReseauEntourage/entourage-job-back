import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CVAmbition } from 'src/cvs/models';

@Injectable()
export class CVAmbitionsHelper {
  constructor(
    @InjectModel(CVAmbition)
    private cvAmbitionModel: typeof CVAmbition
  ) {}

  async countCVAmbitionsByCVId(cvId: string) {
    return this.cvAmbitionModel.count({
      where: {
        CVId: cvId,
      },
    });
  }
}
