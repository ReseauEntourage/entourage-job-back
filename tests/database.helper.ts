import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DestroyOptions } from 'sequelize/types/model';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Contract } from 'src/common/contracts/models';
import { Experience, ExperienceSkill } from 'src/common/experiences/models';
import { Formation, FormationSkill } from 'src/common/formations/models';
import { Language } from 'src/common/languages/models';
import { Passion } from 'src/common/passions/models';
import { Review } from 'src/common/reviews/models';
import { Skill } from 'src/common/skills/models';
import {
  Conversation,
  ConversationParticipant,
  Message,
} from 'src/messaging/models';
import { Organization } from 'src/organizations/models';
import { OrganizationReferent } from 'src/organizations/models/organization-referent.model';
import { Revision, RevisionChange } from 'src/revisions/models';
import {
  UserProfile,
  UserProfileSectorOccupation,
} from 'src/user-profiles/models';
import { UserProfileNudge } from 'src/user-profiles/models/user-profile-nudge.model';
import { UserProfileRecommendation } from 'src/user-profiles/models/user-profile-recommendation.model';
import { User, UserCandidat, UserSocialSituation } from 'src/users/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class DatabaseHelper {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(UserCandidat)
    private userCandidatModel: typeof UserCandidat,
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile,
    @InjectModel(UserProfileSectorOccupation)
    private userProfileSectorOccupationModel: typeof UserProfileSectorOccupation,
    @InjectModel(UserProfileRecommendation)
    private userProfileRecommendationModel: typeof UserProfileRecommendation,
    @InjectModel(UserProfileNudge)
    private userProfileNudge: typeof UserProfileNudge,
    @InjectModel(Skill)
    private skillModel: typeof Skill,
    @InjectModel(Language)
    private languageModel: typeof Language,
    @InjectModel(Contract)
    private contractModel: typeof Contract,
    @InjectModel(Passion)
    private passionModel: typeof Passion,
    @InjectModel(Experience)
    private experienceModel: typeof Experience,
    @InjectModel(ExperienceSkill)
    private experienceSkillModel: typeof ExperienceSkill,
    @InjectModel(Formation)
    private formationModel: typeof Formation,
    @InjectModel(FormationSkill)
    private formationSkillModel: typeof FormationSkill,
    @InjectModel(Review)
    private reviewModel: typeof Review,
    @InjectModel(Organization)
    private organizationModel: typeof Organization,
    @InjectModel(OrganizationReferent)
    private organizationReferentModel: typeof OrganizationReferent,
    @InjectModel(Revision)
    private revisionModel: typeof Revision,
    @InjectModel(RevisionChange)
    private revisionChangeModel: typeof RevisionChange,
    @InjectModel(Message)
    private messageModel: typeof Message,
    @InjectModel(Conversation)
    private conversationModel: typeof Conversation,
    @InjectModel(Message)
    private conversationParticipantModel: typeof ConversationParticipant,
    @InjectModel(UserSocialSituation)
    private userSocialSituationModel: typeof UserSocialSituation,
    @InjectModel(BusinessSector)
    private businessSectorModel: typeof BusinessSector
  ) {}

  async resetTestDB() {
    const destroyOptions: DestroyOptions = {
      cascade: true,
      force: true,
    };
    try {
      await this.messageModel.truncate(destroyOptions);
      await this.conversationParticipantModel.truncate(destroyOptions);
      await this.conversationModel.truncate(destroyOptions);
      await this.revisionChangeModel.truncate(destroyOptions);
      await this.revisionModel.truncate(destroyOptions);
      await this.userProfileSectorOccupationModel.truncate(destroyOptions);
      await this.userProfileNudge.truncate(destroyOptions);
      await this.userProfileRecommendationModel.truncate(destroyOptions);
      await this.experienceSkillModel.truncate(destroyOptions);
      await this.formationModel.truncate(destroyOptions);
      await this.formationSkillModel.truncate(destroyOptions);
      await this.skillModel.truncate(destroyOptions);
      await this.passionModel.truncate(destroyOptions);
      await this.experienceModel.truncate(destroyOptions);
      await this.reviewModel.truncate(destroyOptions);
      await this.organizationModel.truncate(destroyOptions);
      await this.organizationReferentModel.truncate(destroyOptions);
      await this.userCandidatModel.truncate(destroyOptions);
      await this.userSocialSituationModel.truncate(destroyOptions);
      await this.userProfileModel.truncate(destroyOptions);
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
