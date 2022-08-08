import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CVBusinessLine } from 'src/cvs';

@Injectable()
export class CVBusinessLinesHelper {
  constructor(
    @InjectModel(CVBusinessLine)
    private cvBusinessLineModel: typeof CVBusinessLine
  ) {}

  async countCVBusinessLinesByCVId(cvId: string) {
    return this.cvBusinessLineModel.count({
      where: {
        CVId: cvId,
      },
    });
  }
}
