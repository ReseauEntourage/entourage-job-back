import { Injectable } from '@nestjs/common';
import moment from 'moment';
import 'moment/locale/fr';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Nudge } from 'src/common/nudge/models';
import { Skill } from 'src/common/skills/models';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileLanguage } from 'src/user-profiles/models/user-profile-language.model';
import { UserProfileNudge } from 'src/user-profiles/models/user-profile-nudge.model';
import { UserProfileSectorOccupation } from 'src/user-profiles/models/user-profile-sector-occupation.model';
import { UserRole, UserRoles } from 'src/users/users.types';
import { EMBEDDING_CONFIG, EmbeddingType } from './embedding.config';

@Injectable()
export class EmbeddingBuilder {
  build(userRole: UserRole, profile: UserProfile, type: EmbeddingType): string {
    const config = EMBEDDING_CONFIG[type];

    const fields = config.fields
      .map((field) => this.buildField(profile, field, userRole))
      .filter(Boolean);

    return fields.join('\n\n');
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
    if (field === 'sectorOccupations') {
      return this.buildSectorOccupationsField(profile.sectorOccupations);
    }
    if (field === 'skills') {
      return this.buildSkillsField(profile.skills);
    }
    if (field === 'currentJob') {
      return this.buildCurrentJobField(profile.currentJob);
    }

    return this.buildTextField(profile, field);
  };

  private buildTextField(profile: UserProfile, field: keyof UserProfile) {
    return `${field} : ${profile[field]}`;
  }

  private buildExperiencesField(experiences: Experience[]) {
    const items = experiences
      .map((experience) => this.buildExperienceField(experience))
      .filter(Boolean)
      .join('\n\n');
    return `Experiences : \n${items}`;
  }

  private buildDuration(startDate: Date, endDate?: Date): string | undefined {
    const start = moment(startDate);
    if (!start.isValid()) return undefined;

    const end = endDate ? moment(endDate) : undefined;
    if (end && (!end.isValid() || start.isSame(end))) return undefined;

    const reference = end ?? moment();
    const months = reference.diff(start, 'months');
    const prefix = end ? 'Durée' : 'Depuis';

    if (months >= 12) {
      const years = reference.diff(start, 'years');
      return `${prefix} : ${years} an${years > 1 ? 's' : ''}`;
    }
    return `${prefix} : ${months} mois`;
  }

  private buildExperienceField(experience: Experience) {
    const parts = [
      `Nom de l'expérience : ${experience.title}`,
      experience.company ? `Entreprise : ${experience.company}` : undefined,
      experience.location ? `Lieu : ${experience.location}` : undefined,
      experience.startDate
        ? this.buildDuration(
            experience.startDate,
            experience.endDate ?? undefined
          )
        : undefined,
      experience.description
        ? `Description : ${experience.description}`
        : undefined,
      experience.skills?.length
        ? `Compétences : ${experience.skills.map((s) => s.name).join(', ')}`
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
        ? this.buildDuration(
            formation.startDate,
            formation.endDate ?? undefined
          )
        : undefined,
      formation.description
        ? `Description : ${formation.description}`
        : undefined,
      formation.skills?.length
        ? `Compétences : ${formation.skills.map((s) => s.name).join(', ')}`
        : undefined,
    ].filter(Boolean);
    return parts.join('\n');
  }

  private buildSectorOccupationsField(
    sectorOccupations: UserProfileSectorOccupation[]
  ) {
    const sectors = sectorOccupations
      .filter((so) => so.businessSector)
      .map((so) => so.businessSector.name);

    const occupations = sectorOccupations
      .filter((so) => so.occupation)
      .map((so) => so.occupation.name);

    const parts = [
      sectors.length
        ? `Secteurs d'activité : ${sectors.join(', ')}`
        : undefined,
      occupations.length ? `Métiers : ${occupations.join(', ')}` : undefined,
    ].filter(Boolean);

    return parts.join('\n');
  }

  private buildSkillsField(skills: Skill[]) {
    if (!skills?.length) return '';
    return `Compétences : ${skills.map((s) => s.name).join(', ')}`;
  }

  private buildCurrentJobField(currentJob?: string) {
    return currentJob ? `Poste actuel : ${currentJob}` : '';
  }

  private buildFormationsField(formations: Formation[]) {
    const items = formations
      .map((formation) => this.buildFormationField(formation))
      .filter(Boolean)
      .join('\n\n');
    return items ? `Formations : \n${items}` : '';
  }

  private buildNudgesField(nudges: Nudge[], userRole: UserRole) {
    const items = nudges.map((nudge) =>
      userRole === UserRoles.CANDIDATE ? nudge.nameRequest : nudge.nameOffer
    );
    return items.length
      ? `Coup de pouces sélectionnés : \n${items.join(', ')}`
      : '';
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
    return items ? `Languages : \n${items}` : '';
  }
}
