import { Module } from '@nestjs/common';
import { BusinessLinesModule } from 'src/common/business-lines/business-lines.module';
import { BusinessLinesHelper } from './business-lines.helper';

@Module({
  imports: [BusinessLinesModule],
  providers: [BusinessLinesHelper],
  exports: [BusinessLinesHelper],
})
export class BusinessLinesTestingModule {}
