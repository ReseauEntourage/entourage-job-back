import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserProfileLanguage } from 'src/user-profiles/models/user-profile-language.model';
import { LanguagesController } from './languages.controller';
import { LanguagesService } from './languages.service';
import { Language } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Language, UserProfileLanguage])],
  providers: [LanguagesService],
  controllers: [LanguagesController],
  exports: [SequelizeModule, LanguagesService],
})
export class LanguagesModule {}
