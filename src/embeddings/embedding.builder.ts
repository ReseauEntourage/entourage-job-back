import { Injectable } from '@nestjs/common';
import moment from 'moment';
import 'moment/locale/fr';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Nudge } from 'src/common/nudge/models';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileLanguage } from 'src/user-profiles/models/user-profile-language.model';
import { UserProfileNudge } from 'src/user-profiles/models/user-profile-nudge.model';
import { UserRole, UserRoles } from 'src/users/users.types';
import { EMBEDDING_CONFIG } from './embedding.config';

@Injectable()
export class EmbeddingBuilder {
  build(
    userRole: UserRole,
    profile: UserProfile,
    type: 'profile' | 'need'
  ): string {
    const config = EMBEDDING_CONFIG[type];

    const fields = config.fields.map((field) =>
      this.buildField(profile, field, userRole)
    );

    return fields.join('\n');
  }

  private buildField = (
    profile: UserProfile,
    field: keyof UserProfile,
    userRole: UserRole
  ) => {
    if (field === 'experiences') {
      return this.buildExperiencesField(profile.experiences);
    }
    if (field === 'formations') {
      return this.buildFormationsField(profile.formations);
    }
    if (field === 'languages') {
      return this.buildLanguagesField(profile.userProfileLanguages);
    }
    if (field === 'nudges') {
      return this.buildNudgesField(profile.nudges, userRole);
    }
    if (field === 'customNudges') {
      return this.buildCustomNudgesField(profile.customNudges);
    }

    return this.buildTextField(profile, field);
  };

  private buildTextField(profile: UserProfile, field: keyof UserProfile) {
    return `${field} : ${profile[field]}`;
  }

  private buildExperiencesField(experiences: Experience[]) {
    const items = experiences
      .map((experience) => this.buildExperienceField(experience))
      .join('\n\n');
    return `Experiences : \n${items}`;
  }

  private buildExperienceField(experience: Experience) {
    const parts = [
      `Nom de l'expérience : ${experience.title}`,
      `Entreprise : ${experience.company}`,
      experience.location ? `Lieu : ${experience.location}` : undefined,
      experience.startDate
        ? `Date de début : ${moment(experience.startDate).format('YYYY-MM-DD')}`
        : undefined,
      experience.endDate
        ? `Date de fin : ${moment(experience.endDate).format('YYYY-MM-DD')}`
        : undefined,
      experience.description
        ? `Description : ${experience.description}`
        : undefined,
    ].filter(Boolean);
    return parts.join('\n');
  }

  private buildFormationField(formation: Formation) {
    const parts = [
      `Nom de la formation : ${formation.title}`,
      `Institution : ${formation.institution}`,
      formation.location ? `Lieu : ${formation.location}` : undefined,
      formation.startDate
        ? `Date de début : ${moment(formation.startDate).format('YYYY-MM-DD')}`
        : undefined,
      formation.endDate
        ? `Date de fin : ${moment(formation.endDate).format('YYYY-MM-DD')}`
        : undefined,
      formation.description
        ? `Description : ${formation.description}`
        : undefined,
    ].filter(Boolean);
    return parts.join('\n');
  }

  private buildFormationsField(formations: Formation[]) {
    const items = formations
      .map((formation) => this.buildFormationField(formation))
      .join('\n\n');
    return `Formations : \n${items}`;
  }

  private buildNudgesField(nudges: Nudge[], userRole: UserRole) {
    const items = nudges.map((nudge) =>
      userRole === UserRoles.CANDIDATE ? nudge.nameRequest : nudge.nameOffer
    );
    return `Coup de pouces séléctionnés : \n${items.join(', ')}`;
  }

  private buildCustomNudgesField(customNudges: UserProfileNudge[]) {
    const items = customNudges.map((customNudge) => customNudge.content);
    return `Coup de pouces personnalisés : \n${items.join(', ')}`;
  }

  private buildLanguagesField(userProfileLanguages: UserProfileLanguage[]) {
    const items = userProfileLanguages
      .map(
        (language) => `${language.language.name} (niveau: ${language.level})`
      )
      .join('\n');
    return `Languages : \n${items}`;
  }
}
