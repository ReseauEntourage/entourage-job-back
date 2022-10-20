import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CVSearch } from 'src/cvs/models';

@Injectable()
export class CVSearchesHelper {
  constructor(
    @InjectModel(CVSearch)
    private cvSearchModel: typeof CVSearch
  ) {}

  async countCVSearchesByCVId(cvId: string) {
    return this.cvSearchModel.count({
      where: {
        CVId: cvId,
      },
    });
  }
}
