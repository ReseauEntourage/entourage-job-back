import { Module } from '@nestjs/common';
import { BusinessLinesHelper } from './businessLines.helper';
import { BusinessLinesModule } from 'src/businessLines';

@Module({
  imports: [BusinessLinesModule],
  providers: [BusinessLinesHelper],
  exports: [BusinessLinesHelper],
})
export class BusinessLinesTestingModule {}
