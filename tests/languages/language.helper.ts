import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Language } from 'src/common/languages/models';
import { LanguageFactory } from './language.factory';

@Injectable()
export class LanguageHelper {
  constructor(
    @InjectModel(Language)
    private languageModel: typeof Language,
    private languageFactory: LanguageFactory
  ) {}

  async findOne({ value }: { value: string }) {
    return this.languageModel.findOne({
      where: { value },
    });
  }

  async deleteAllLanguages() {
    try {
      await this.languageModel.destroy({
        where: {},
        force: true,
      });
    } catch (err) {
      console.error('Error deleting languages:', err);
      throw err;
    }
  }

  async seedLanguages() {
    const languages = [
      {
        name: 'Français',
        value: 'fr',
      },
      {
        name: 'Anglais',
        value: 'en',
      },
      {
        name: 'Espagnol',
        value: 'es',
      },
      {
        name: 'Allemand',
        value: 'de',
      },
      {
        name: 'Italien',
        value: 'it',
      },
      {
        name: 'Portugais',
        value: 'pt',
      },
      {
        name: 'Néerlandais',
        value: 'nl',
      },
      {
        name: 'Russe',
        value: 'ru',
      },
      {
        name: 'Chinois',
        value: 'zh',
      },
      {
        name: 'Japonais',
        value: 'ja',
      },
    ];

    try {
      for (const language of languages) {
        await this.languageFactory.create({
          name: language.name,
          value: language.value,
        });
      }
    } catch (err) {
      console.error('Error seeding languages:', err);
    }
  }
}
