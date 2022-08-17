import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ExperienceSkill } from 'src/experiences/models';

@Injectable()
export class ExperiencesSkillsHelper {
  constructor(
    @InjectModel(ExperienceSkill)
    private experienceSkillModel: typeof ExperienceSkill
  ) {}

  async countExperienceSkillsByExperienceId(experienceId: string) {
    return this.experienceSkillModel.count({
      where: {
        ExperienceId: experienceId,
      },
    });
  }
}
