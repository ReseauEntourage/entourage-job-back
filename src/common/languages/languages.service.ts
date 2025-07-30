import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserProfileLanguage } from 'src/user-profiles/models/user-profile-language.model';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { Language } from './models';

@Injectable()
export class LanguagesService {
  constructor(
    @InjectModel(Language)
    private languageModel: typeof Language,
    @InjectModel(UserProfileLanguage)
    private userProfileLanguageModel: typeof UserProfileLanguage
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

  async findByValue(value: string): Promise<Language | null> {
    const language = await this.languageModel.findOne({
      where: { value },
    });

    return language || null;
  }

  async findLanguagesByUserProfileId(userProfileId: string) {
    return this.userProfileLanguageModel.findAll({
      where: { userProfileId },
      attributes: ['id', 'level'],
      include: [
        {
          model: Language,
          as: 'language',
          required: false,
          attributes: ['id', 'name'],
        },
      ],
    });
  }
}
