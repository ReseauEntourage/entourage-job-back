import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DestroyOptions } from 'sequelize/types/model';
import { Factory } from '../src/utils/types';
import { Ambition } from 'src/ambitions/models';
import { BusinessLine } from 'src/businessLines/models';
import { Contract } from 'src/contracts/models';
import {
  CV,
  CVAmbition,
  CVBusinessLine,
  CVContract,
  CVLanguage,
  CVLocation,
  CVPassion,
  CVSearch,
  CVSkill,
} from 'src/cvs/models';
import { Experience, ExperienceSkill } from 'src/experiences/models';
import { Language } from 'src/languages/models';
import { Location } from 'src/locations/models';
import { Passion } from 'src/passions/models';
import { Review } from 'src/reviews/models';
import { Share } from 'src/shares/models';
import { Skill } from 'src/skills/models';
import { UserCandidat, User } from 'src/users/models';

@Injectable()
export class DatabaseHelper {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(UserCandidat)
    private userCandidatModel: typeof UserCandidat,
    @InjectModel(CV)
    private cvModel: typeof CV,
    @InjectModel(Location)
    private locationModel: typeof Location,
    @InjectModel(CVLocation)
    private cvLocationModel: typeof CVLocation,
    @InjectModel(BusinessLine)
    private businessLineModel: typeof BusinessLine,
    @InjectModel(CVBusinessLine)
    private cvBusinessLineModel: typeof CVBusinessLine,
    @InjectModel(Skill)
    private skillModel: typeof Skill,
    @InjectModel(CVSkill)
    private cvSkillModel: typeof CVSkill,
    @InjectModel(Language)
    private languageModel: typeof Language,
    @InjectModel(CVLanguage)
    private cvLanguageModel: typeof CVLanguage,
    @InjectModel(Contract)
    private contractModel: typeof Contract,
    @InjectModel(CVContract)
    private cvContractModel: typeof CVContract,
    @InjectModel(Ambition)
    private ambitionModel: typeof Ambition,
    @InjectModel(CVAmbition)
    private cvAmbitionModel: typeof CVAmbition,
    @InjectModel(Passion)
    private passionModel: typeof Passion,
    @InjectModel(CVPassion)
    private cvPassionModel: typeof CVPassion,
    @InjectModel(Experience)
    private experienceModel: typeof Experience,
    @InjectModel(ExperienceSkill)
    private experienceSkillModel: typeof ExperienceSkill,
    @InjectModel(Review)
    private reviewModel: typeof Review,
    @InjectModel(CVSearch)
    private cvSearchModel: typeof CVSearch,
    @InjectModel(Share)
    private shareModel: typeof Share
  ) {}

  async resetTestDB() {
    const destroyOptions: DestroyOptions = {
      where: {},
      truncate: true,
      cascade: true,
    };
    try {
      await this.cvLocationModel.destroy(destroyOptions);
      await this.cvBusinessLineModel.destroy(destroyOptions);
      await this.cvSkillModel.destroy(destroyOptions);
      await this.cvLanguageModel.destroy(destroyOptions);
      await this.cvContractModel.destroy(destroyOptions);
      await this.cvAmbitionModel.destroy(destroyOptions);
      await this.cvPassionModel.destroy(destroyOptions);
      await this.experienceSkillModel.destroy(destroyOptions);
      await this.locationModel.destroy(destroyOptions);
      await this.businessLineModel.destroy(destroyOptions);
      await this.skillModel.destroy(destroyOptions);
      await this.languageModel.destroy(destroyOptions);
      await this.passionModel.destroy(destroyOptions);
      await this.contractModel.destroy(destroyOptions);
      await this.ambitionModel.destroy(destroyOptions);
      await this.passionModel.destroy(destroyOptions);
      await this.experienceModel.destroy(destroyOptions);
      await this.cvSearchModel.destroy(destroyOptions);
      await this.reviewModel.destroy(destroyOptions);
      await this.shareModel.destroy(destroyOptions);
      await this.cvModel.destroy(destroyOptions);
      await this.userCandidatModel.destroy(destroyOptions);
      await this.userModel.destroy(destroyOptions);
    } catch (err) {
      console.error(err);
    }
  }

  async createEntities<
    F extends Factory<Awaited<ReturnType<F['create']>>>,
    A extends Parameters<F['create']>
  >(factory: F, n: number, ...args: A) {
    const promises: Promise<Awaited<ReturnType<F['create']>>>[] = [];
    for (let i = 0; i < n; i += 1) {
      promises.push(factory.create(...args));
    }

    return Promise.all(promises);
  }
}
