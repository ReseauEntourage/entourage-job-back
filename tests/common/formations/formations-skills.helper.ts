import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FormationSkill } from 'src/common/formations/models';

@Injectable()
export class FormationsSkillsHelper {
  constructor(
    @InjectModel(FormationSkill)
    private experienceSkillModel: typeof FormationSkill
  ) {}

  async countFormationSkillsByFormationId(experienceId: string) {
    return this.experienceSkillModel.count({
      where: {
        FormationId: experienceId,
      },
    });
  }
}
