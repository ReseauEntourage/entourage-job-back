import { Module } from '@nestjs/common';
import { FormationsModule } from 'src/common/formations/formations.module';
import { FormationFactory } from './formation.factory';

@Module({
  imports: [FormationsModule],
  providers: [FormationFactory],
  exports: [],
})
export class FormationsTestingModule {}
