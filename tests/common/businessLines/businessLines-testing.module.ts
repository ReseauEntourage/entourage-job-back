import { Module } from '@nestjs/common';
import { BusinessLinesModule } from 'src/common/businessLines/businessLines.module';
import { BusinessLinesHelper } from './businessLines.helper';

@Module({
  imports: [BusinessLinesModule],
  providers: [BusinessLinesHelper],
  exports: [BusinessLinesHelper],
})
export class BusinessLinesTestingModule {}
