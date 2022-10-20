import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CVLanguage } from 'src/cvs/models';

@Injectable()
export class CVLanguagesHelper {
  constructor(
    @InjectModel(CVLanguage)
    private cvLanguageModel: typeof CVLanguage
  ) {}

  async countCVLanguagesByCVId(cvId: string) {
    return this.cvLanguageModel.count({
      where: {
        CVId: cvId,
      },
    });
  }
}
