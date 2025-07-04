import { Module } from '@nestjs/common';
import { LanguagesModule } from 'src/common/languages/languages.module';
import { LanguageFactory } from './language.factory';
import { LanguageHelper } from './language.helper';

@Module({
  imports: [LanguagesModule],
  providers: [LanguageHelper, LanguageFactory],
  exports: [LanguageHelper],
})
export class LanguagesTestingModule {}
