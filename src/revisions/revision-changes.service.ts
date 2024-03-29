import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { RevisionChange } from './models';

@Injectable()
export class RevisionChangesService {
  constructor(
    @InjectModel(RevisionChange)
    private revisionChangeModel: typeof RevisionChange
  ) {}

  async updateByRevisionsIds(
    revisionsIds: string[],
    updateRevisionChangeDto: Partial<RevisionChange>
  ) {
    return this.revisionChangeModel.update(updateRevisionChangeDto, {
      where: {
        revisionId: revisionsIds,
      },
    });
  }
}
