import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Language } from 'src/languages/models';

@Injectable()
export class LanguagesHelper {
  constructor(
    @InjectModel(Language)
    private languageModel: typeof Language
  ) {}

  async countLanguagesByName(names: string | string[]) {
    if (!Array.isArray(names)) {
      names = [names];
    }
    return this.languageModel.count({
      where: {
        name: {
          [Op.or]: names,
        },
      },
    });
  }
}
