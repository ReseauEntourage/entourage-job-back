import { Module } from '@nestjs/common';
import { ReportsModule } from 'src/reports/reports.module';
import { ReportFactory } from './report.factory';

@Module({
  imports: [ReportsModule],
  providers: [ReportFactory],
  exports: [ReportFactory],
})
export class ReportsTestingModule {}
