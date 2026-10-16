import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Report } from 'src/reports/models';
import { ReportReasons } from 'src/reports/reports.types';
import { Factory } from 'src/utils/types';

@Injectable()
export class ReportFactory implements Factory<Report> {
  constructor(
    @InjectModel(Report)
    private reportModel: typeof Report
  ) {}

  async create(
    props: Partial<Report> &
      Pick<Report, 'targetType' | 'targetId' | 'reporterId'>
  ): Promise<Report> {
    const report = await this.reportModel.create({
      reason: ReportReasons.SPAM,
      ...props,
    });
    return report.toJSON();
  }
}
