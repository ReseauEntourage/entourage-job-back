import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Experience } from 'src/experiences/models';

@Injectable()
export class ExperiencesHelper {
  constructor(
    @InjectModel(Experience)
    private experienceModel: typeof Experience
  ) {}

  async countExperiencesByCVId(cvId: string) {
    return this.experienceModel.count({
      where: {
        CVId: cvId,
      },
    });
  }
}
