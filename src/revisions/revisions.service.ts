import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Revision } from './models';

@Injectable()
export class RevisionsService {
  constructor(
    @InjectModel(Revision)
    private revisionModel: typeof Revision
  ) {}

  async findAllByDocumentsIds(documentsIds: string[]) {
    return this.revisionModel.findAll({
      where: {
        documentId: documentsIds,
      },
    });
  }

  async updateByDocumentsIds(
    documentsIds: string[],
    updateRevisionDto: Partial<Revision>
  ) {
    return this.revisionModel.update(updateRevisionDto, {
      where: {
        documentId: documentsIds,
      },
    });
  }
}
