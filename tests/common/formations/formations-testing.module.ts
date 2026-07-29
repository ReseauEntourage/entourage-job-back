import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Formation, FormationSkill } from 'src/formations/models';
import { FormationFactory } from './formation.factory';

@Module({
  imports: [SequelizeModule.forFeature([Formation, FormationSkill])],
  providers: [FormationFactory],
  exports: [],
})
export class FormationsTestingModule {}
