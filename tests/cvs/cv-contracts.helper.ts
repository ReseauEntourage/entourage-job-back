import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CVContract } from 'src/cvs/models';

@Injectable()
export class CVContractsHelper {
  constructor(
    @InjectModel(CVContract)
    private cvContractModel: typeof CVContract
  ) {}

  async countCVContractsByCVId(cvId: string) {
    return this.cvContractModel.count({
      where: {
        CVId: cvId,
      },
    });
  }
}
