import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CVLocation } from 'src/cvs';

@Injectable()
export class CVLocationsHelper {
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
