import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Formation, FormationSkill } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Formation, FormationSkill])],
  exports: [SequelizeModule],
})
export class FormationsModule {}
