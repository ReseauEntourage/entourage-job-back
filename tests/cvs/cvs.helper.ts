import path from 'path';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CVsService } from 'src/cvs/cvs.service';
import { CV } from 'src/cvs/models';

@Injectable()
export class CVsHelper {
  constructor(
    @InjectModel(CV)
    private cvModel: typeof CV,
    private cvsService: CVsService
  ) {}

  getTestImagePath() {
    return path.join(process.cwd(), '/tests/test-data/image-test.jpg');
  }

  getTestHtmlPagePath() {
    return (
      'file://' + path.join(process.cwd(), '/tests/test-data/page-test.html')
    );
  }

  async findAllCVsByCandidateId(candidateId: string) {
    return this.cvModel.findAll({
      where: {
        UserId: candidateId,
      },
    });
  }

  async findCVByCandidateId(candidateId: string) {
    return this.cvsService.findOneByCandidateId(candidateId);
  }
}
