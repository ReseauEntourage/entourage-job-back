import { Module } from '@nestjs/common';
import { ElearningModule } from 'src/elearning/elearning.module';
import { ElearningUnitFactory } from './elearning-unit.factory';

@Module({
  imports: [ElearningModule],
  providers: [ElearningUnitFactory],
  exports: [ElearningUnitFactory],
})
export class ElearningTestingModule {}
