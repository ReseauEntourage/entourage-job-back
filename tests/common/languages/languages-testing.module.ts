import { Module } from '@nestjs/common';
import { LanguagesModule } from 'src/common/languages/languages.module';
import { LanguagesHelper } from './languages.helper';

@Module({
  imports: [LanguagesModule],
  providers: [LanguagesHelper],
  exports: [LanguagesHelper],
})
export class LanguagesTestingModule {}
