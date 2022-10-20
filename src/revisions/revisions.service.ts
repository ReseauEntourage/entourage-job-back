import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Revision } from './models';

@Injectable()
export class RevisionsService {
  constructor(
    @InjectModel(Revision)
    private revisionModel: typeof Revision
  ) {}

  async findAllByDocumentIds(documentIds: string[]) {
    return this.revisionModel.findAll({
      where: {
        documentId: documentIds,
      },
    });
  }

  async updateByDocumentIds(
    documentIds: string[],
    updateRevisionDto: Partial<Revision>
  ) {
    return this.revisionModel.update(updateRevisionDto, {
      where: {
        documentId: documentIds,
      },
    });
  }
}
