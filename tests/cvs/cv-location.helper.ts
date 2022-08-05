import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Location } from 'src/locations';
import { CVLocation } from '../../src/cvs';

@Injectable()
export class CVLocationHelper {
  constructor(
    @InjectModel(CVLocation)
    private cvLocationModel: typeof CVLocation
  ) {}

  async countCVLocationsByCVId(cvId: string) {
    return this.cvLocationModel.count({
      where: {
        CVId: cvId,
      },
    });
  }
}
