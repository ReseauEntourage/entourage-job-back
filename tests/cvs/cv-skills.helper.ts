import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CVSkill } from 'src/cvs/models';

@Injectable()
export class CVSkillsHelper {
  constructor(
    @InjectModel(CVSkill)
    private cvSkillModel: typeof CVSkill
  ) {}

  async countCVSkillsByCVId(cvId: string) {
    return this.cvSkillModel.count({
      where: {
        CVId: cvId,
      },
    });
  }
}
