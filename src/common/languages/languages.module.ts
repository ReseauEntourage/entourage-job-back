import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LanguagesController } from './languages.controller';
import { LanguagesService } from './languages.service';
import { Language } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Language])],
  providers: [LanguagesService],
  controllers: [LanguagesController],
  exports: [SequelizeModule],
})
export class LanguagesModule {}
