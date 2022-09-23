import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Language } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Language])],
  exports: [SequelizeModule],
})
export class LanguagesModule {}
