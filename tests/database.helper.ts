import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DestroyOptions } from 'sequelize/types/model';
import { OpportunityUserEvent } from '../src/opportunities/models/opportunity-user-event.model';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/businessLines/models';
import { Contract } from 'src/common/contracts/models';
import { Experience, ExperienceSkill } from 'src/common/experiences/models';
import { Language } from 'src/common/languages/models';
import { Location } from 'src/common/locations/models';
import { Passion } from 'src/common/passions/models';
import { Review } from 'src/common/reviews/models';
import { Skill } from 'src/common/skills/models';
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
import {
  Opportunity,
  OpportunityBusinessLine,
  OpportunityUser,
  OpportunityUserStatusChange,
} from 'src/opportunities/models';
import { Revision, RevisionChange } from 'src/revisions/models';
import { Share } from 'src/shares/models';
import { UserCandidat, User } from 'src/users/models';
import { Factory } from 'src/utils/types';

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
    @InjectModel(OpportunityBusinessLine)
    private opportunityBusinessLineModel: typeof OpportunityBusinessLine,
    @InjectModel(Opportunity)
    private opportunityModel: typeof Opportunity,
    @InjectModel(OpportunityUser)
    private opportunityUserModel: typeof OpportunityUser,
    @InjectModel(OpportunityUserEvent)
    private opportunityUserEventModel: typeof OpportunityUserEvent,
    @InjectModel(OpportunityUserStatusChange)
    private opportunityUserStatusChangeModel: typeof OpportunityUserStatusChange,
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
    private shareModel: typeof Share,
    @InjectModel(Revision)
    private revisionModel: typeof Revision,
    @InjectModel(RevisionChange)
    private revisionChangeModel: typeof RevisionChange
  ) {}

  async resetTestDB() {
    const destroyOptions: DestroyOptions = {
      cascade: true,
      force: true,
    };
    try {
      await this.revisionChangeModel.truncate(destroyOptions);
      await this.revisionModel.truncate(destroyOptions);
      await this.cvLocationModel.truncate(destroyOptions);
      await this.cvBusinessLineModel.truncate(destroyOptions);
      await this.cvSkillModel.truncate(destroyOptions);
      await this.cvLanguageModel.truncate(destroyOptions);
      await this.cvContractModel.truncate(destroyOptions);
      await this.cvAmbitionModel.truncate(destroyOptions);
      await this.cvPassionModel.truncate(destroyOptions);
      await this.opportunityBusinessLineModel.truncate(destroyOptions);
      await this.experienceSkillModel.truncate(destroyOptions);
      await this.locationModel.truncate(destroyOptions);
      await this.businessLineModel.truncate(destroyOptions);
      await this.skillModel.truncate(destroyOptions);
      await this.languageModel.truncate(destroyOptions);
      await this.passionModel.truncate(destroyOptions);
      await this.contractModel.truncate(destroyOptions);
      await this.ambitionModel.truncate(destroyOptions);
      await this.passionModel.truncate(destroyOptions);
      await this.experienceModel.truncate(destroyOptions);
      await this.cvSearchModel.truncate(destroyOptions);
      await this.reviewModel.truncate(destroyOptions);
      await this.shareModel.truncate(destroyOptions);
      await this.opportunityUserEventModel.truncate(destroyOptions);
      await this.opportunityUserStatusChangeModel.truncate(destroyOptions);
      await this.opportunityUserModel.truncate(destroyOptions);
      await this.opportunityModel.truncate(destroyOptions);
      await this.cvModel.truncate(destroyOptions);
      await this.userCandidatModel.truncate(destroyOptions);
      await this.userModel.truncate(destroyOptions);
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
