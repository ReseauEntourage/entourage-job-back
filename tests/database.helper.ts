import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DestroyOptions } from 'sequelize/types/model';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/business-lines/models';
import { Contract } from 'src/common/contracts/models';
import { Experience, ExperienceSkill } from 'src/common/experiences/models';
import { Formation, FormationSkill } from 'src/common/formations/models';
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
  Conversation,
  ConversationParticipant,
  Message,
} from 'src/messaging/models';
import {
  Opportunity,
  OpportunityBusinessLine,
  OpportunityUser,
  OpportunityUserStatusChange,
} from 'src/opportunities/models';
import { OpportunityUserEvent } from 'src/opportunities/models/opportunity-user-event.model';
import { Organization } from 'src/organizations/models';
import { OrganizationReferent } from 'src/organizations/models/organization-referent.model';
import { Revision, RevisionChange } from 'src/revisions/models';
import { Share } from 'src/shares/models';
import {
  HelpNeed,
  HelpOffer,
  UserProfile,
  UserProfileNetworkBusinessLine,
  UserProfileSearchAmbition,
  UserProfileSearchBusinessLine,
} from 'src/user-profiles/models';
import { UserProfileRecommendation } from 'src/user-profiles/models/user-profile-recommendation.model';
import { User, UserCandidat } from 'src/users/models';
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
    @InjectModel(UserProfileNetworkBusinessLine)
    private userProfileNetworkBusinessLineModel: typeof UserProfileNetworkBusinessLine,
    @InjectModel(UserProfileSearchAmbition)
    private userProfileSearchAmbitionModel: typeof UserProfileSearchAmbition,
    @InjectModel(UserProfileSearchBusinessLine)
    private userProfileSearchBusinessLineModel: typeof UserProfileSearchBusinessLine,
    @InjectModel(UserProfileRecommendation)
    private userProfileRecommendationModel: typeof UserProfileRecommendation,
    @InjectModel(HelpNeed)
    private helpNeedModel: typeof HelpNeed,
    @InjectModel(HelpOffer)
    private helpOfferModel: typeof HelpOffer,
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
    @InjectModel(Formation)
    private formationModel: typeof Formation,
    @InjectModel(FormationSkill)
    private formationSkillModel: typeof FormationSkill,
    @InjectModel(Review)
    private reviewModel: typeof Review,
    @InjectModel(CVSearch)
    private cvSearchModel: typeof CVSearch,
    @InjectModel(Share)
    private shareModel: typeof Share,
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
    private conversationParticipantModel: typeof ConversationParticipant
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
      await this.userProfileNetworkBusinessLineModel.truncate(destroyOptions);
      await this.userProfileSearchBusinessLineModel.truncate(destroyOptions);
      await this.userProfileSearchAmbitionModel.truncate(destroyOptions);
      await this.helpNeedModel.truncate(destroyOptions);
      await this.helpOfferModel.truncate(destroyOptions);
      await this.userProfileRecommendationModel.truncate(destroyOptions);
      await this.cvLocationModel.truncate(destroyOptions);
      await this.cvBusinessLineModel.truncate(destroyOptions);
      await this.cvSkillModel.truncate(destroyOptions);
      await this.cvLanguageModel.truncate(destroyOptions);
      await this.cvContractModel.truncate(destroyOptions);
      await this.cvAmbitionModel.truncate(destroyOptions);
      await this.cvPassionModel.truncate(destroyOptions);
      await this.opportunityBusinessLineModel.truncate(destroyOptions);
      await this.experienceSkillModel.truncate(destroyOptions);
      await this.formationModel.truncate(destroyOptions);
      await this.formationSkillModel.truncate(destroyOptions);
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
      await this.organizationModel.truncate(destroyOptions);
      await this.organizationReferentModel.truncate(destroyOptions);
      await this.userCandidatModel.truncate(destroyOptions);
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
