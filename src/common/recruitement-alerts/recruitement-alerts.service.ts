import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import {
  RecruitementAlert,
  RecruitementAlertBusinessSector,
  RecruitementAlertSkill,
} from './models';

@Injectable()
export class RecruitementAlertsService {
  constructor(
    @InjectModel(RecruitementAlert)
    private recruitementAlertModel: typeof RecruitementAlert,
    @InjectModel(RecruitementAlertBusinessSector)
    private recruitementAlertBusinessSectorModel: typeof RecruitementAlertBusinessSector,
    @InjectModel(RecruitementAlertSkill)
    private recruitementAlertSkillModel: typeof RecruitementAlertSkill
  ) {}
}
