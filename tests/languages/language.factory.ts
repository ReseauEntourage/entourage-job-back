// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as uuid from 'uuid';
import { Language } from 'src/common/languages/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class LanguageFactory implements Factory<Language> {
  constructor(
    @InjectModel(Language)
    private language: typeof Language
  ) {}

  generateLanguage(props: Partial<Language>): Partial<Language> {
    const name =
      props.name || faker.lorem.word({ length: { min: 5, max: 10 } });
    return {
      id: uuid.v4(),
      name: name,
      value: props.value || name.slice(0, 3),
    };
  }

  async create(props: Partial<Language> = {}): Promise<Language> {
    const language = this.generateLanguage(props);
    return this.language.create(language);
  }
}
