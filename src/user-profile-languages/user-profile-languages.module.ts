import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserProfileLanguage } from 'src/user-profiles/models/user-profile-language.model';
import { UserProfileLanguagesService } from './user-profile-languages.service';

@Module({
  imports: [SequelizeModule.forFeature([UserProfileLanguage])],
  providers: [UserProfileLanguagesService],
  exports: [SequelizeModule, UserProfileLanguagesService],
})
export class UserProfileLanguagesModule {}
