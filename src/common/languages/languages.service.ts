import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { Language } from './models';

@Injectable()
export class LanguagesService {
  constructor(
    @InjectModel(Language)
    private languageModel: typeof Language
  ) {}

  async findAll(limit: number, offset: number, search = '') {
    const whereQuery = searchInColumnWhereOption('Language.name', search);

    return this.languageModel.findAll({
      where: whereQuery,
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
      order: [['name', 'ASC']],
    });
  }
}
