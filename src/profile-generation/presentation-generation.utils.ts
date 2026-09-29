import { Company } from 'src/companies/models/company.model';
import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import { Gender, Genders, UserRoles } from 'src/users/users.types';
import {
  buildPresentationSystemPrompt,
  GENDER_INSTRUCTIONS,
  PRESENTATION_MAX_LENGTH,
  ROLE_INSTRUCTIONS,
} from './presentation-generation.config';

/**
 * Candidates get the candidate writing rules; coaches, referers and admins all
 * get the coach ones.
 */
export type PresentationRole = 'candidate' | 'coach';

interface PromptExperience {
  company?: string;
  description?: string;
  period?: string;
  skills: string[];
  title?: string;
}

interface PromptFormation {
  description?: string;
  institution?: string;
  period?: string;
  skills: string[];
  title?: string;
}

/**
 * Whitelist of the profile data sent to the model. Anything that is not a
 * field of this type (social situation, contact details, free-text nudges,
 * languages, interests…) can never reach the prompt.
 */
export interface PresentationPromptInput {
  company?: string;
  currentJob?: string;
  experiences: PromptExperience[];
  formations: PromptFormation[];
  gender: Gender;
  nudges: string[];
  role: PresentationRole;
  // Coach, referer and admin only
  sectors: string[];
  skills: string[];
  // Candidate only
  soughtJobs: { sector?: string; occupation?: string }[];
}

export type PresentationOutcome = 'success' | 'truncated' | 'empty';

const toPresentationRole = (role: string): PresentationRole =>
  role === UserRoles.CANDIDATE ? 'candidate' : 'coach';

const toGender = (gender: number | null | undefined): Gender =>
  gender === Genders.FEMALE || gender === Genders.MALE ? gender : Genders.OTHER;

/**
 * Strips angle brackets so a user value can never close the <profil> block,
 * and collapses whitespace. Empty values become undefined so they are omitted.
 */
const clean = (value: string | null | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const cleaned = value.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
};

const year = (date: Date | string | null | undefined): string | undefined => {
  if (!date) {
    return undefined;
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? undefined
    : String(parsed.getFullYear());
};

const period = (
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined
): string | undefined => {
  const start = year(startDate);
  const end = year(endDate);
  if (start && end) {
    return `${start} – ${end}`;
  }
  if (start) {
    return `depuis ${start}`;
  }
  return end;
};

const names = (items: { name?: string | null }[] | null | undefined) =>
  (items ?? []).map((item) => clean(item.name)).filter(Boolean) as string[];

export const buildPresentationPromptInput = (
  user: Pick<User, 'role' | 'gender'> & { companies?: Company[] },
  userProfile: UserProfile
): PresentationPromptInput => {
  const role = toPresentationRole(user.role);
  const sectorOccupations = userProfile.sectorOccupations ?? [];

  return {
    role,
    gender: toGender(user.gender),
    experiences: (userProfile.experiences ?? []).map((experience) => ({
      title: clean(experience.title),
      company: clean(experience.company),
      period: period(experience.startDate, experience.endDate),
      description: clean(experience.description),
      skills: names(experience.skills),
    })),
    formations: (userProfile.formations ?? []).map((formation) => ({
      title: clean(formation.title),
      institution: clean(formation.institution),
      period: period(formation.startDate, formation.endDate),
      description: clean(formation.description),
      skills: names(formation.skills),
    })),
    skills: names(userProfile.skills),
    soughtJobs:
      role === 'candidate'
        ? sectorOccupations
            .map((sectorOccupation) => ({
              sector: clean(sectorOccupation.businessSector?.name),
              occupation: clean(sectorOccupation.occupation?.name),
            }))
            .filter((job) => job.sector || job.occupation)
        : [],
    sectors:
      role === 'coach'
        ? (sectorOccupations
            .map((sectorOccupation) =>
              clean(sectorOccupation.businessSector?.name)
            )
            .filter(Boolean) as string[])
        : [],
    currentJob: role === 'coach' ? clean(userProfile.currentJob) : undefined,
    company: role === 'coach' ? clean(user.companies?.[0]?.name) : undefined,
    // Only nudges from the reference list: free-text ones (customNudges) are
    // stored separately and never loaded here.
    nudges:
      role === 'coach'
        ? ((userProfile.nudges ?? [])
            .map((nudge) => clean(nudge.nameOffer))
            .filter(Boolean) as string[])
        : [],
  };
};

export const hasParcours = (input: PresentationPromptInput): boolean =>
  input.experiences.length > 0 || input.formations.length > 0;

const line = (label: string, value: string | undefined) =>
  value ? `${label} : ${value}` : undefined;

const joinFields = (fields: (string | undefined)[]) =>
  fields.filter(Boolean).join(' ; ');

export const buildPresentationSystemPromptFor = (
  input: PresentationPromptInput
): string =>
  buildPresentationSystemPrompt(
    ROLE_INSTRUCTIONS[input.role],
    GENDER_INSTRUCTIONS[input.gender]
  );

/**
 * Renders the whitelisted data as the user message. Empty sources are
 * omitted entirely, without placeholder values.
 */
export const buildPresentationUserMessage = (
  input: PresentationPromptInput
): string => {
  const sections: string[] = [
    `Rôle : ${input.role === 'candidate' ? 'candidat' : 'coach bénévole'}`,
  ];

  if (input.role === 'candidate' && input.soughtJobs.length > 0) {
    sections.push(
      'Métiers recherchés :',
      ...input.soughtJobs.map(
        (job) =>
          `- ${joinFields([
            line('Métier', job.occupation),
            line('Secteur', job.sector),
          ])}`
      )
    );
  }

  if (input.role === 'coach') {
    const currentJob = line('Métier actuel', input.currentJob);
    const company = line('Entreprise', input.company);
    if (currentJob) sections.push(currentJob);
    if (company) sections.push(company);
    if (input.sectors.length > 0) {
      sections.push(`Secteurs : ${input.sectors.join(', ')}`);
    }
    if (input.nudges.length > 0) {
      sections.push(
        'Coups de pouce proposés :',
        ...input.nudges.map((nudge) => `- ${nudge}`)
      );
    }
  }

  if (input.experiences.length > 0) {
    sections.push(
      'Expériences :',
      ...input.experiences.map(
        (experience) =>
          `- ${joinFields([
            line('Poste', experience.title),
            line('Entreprise', experience.company),
            line('Période', experience.period),
            line('Description', experience.description),
            experience.skills.length > 0
              ? line('Compétences', experience.skills.join(', '))
              : undefined,
          ])}`
      )
    );
  }

  if (input.formations.length > 0) {
    sections.push(
      'Formations :',
      ...input.formations.map(
        (formation) =>
          `- ${joinFields([
            line('Intitulé', formation.title),
            line('Établissement', formation.institution),
            line('Période', formation.period),
            line('Description', formation.description),
            formation.skills.length > 0
              ? line('Compétences', formation.skills.join(', '))
              : undefined,
          ])}`
      )
    );
  }

  if (input.skills.length > 0) {
    sections.push(`Compétences : ${input.skills.join(', ')}`);
  }

  return `<profil>\n${sections.join('\n')}\n</profil>`;
};

/**
 * Cleans the model output and enforces the length limit by cutting at the
 * last sentence end before the limit (or, failing that, at the last word).
 */
export const postProcessPresentation = (
  raw: string
): { description: string | null; outcome: PresentationOutcome } => {
  const cleaned = raw
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .trim()
    .replace(/^["«“]+\s*/, '')
    .replace(/\s*["»”]+$/, '')
    .trim();

  if (!cleaned) {
    return { description: null, outcome: 'empty' };
  }

  if (cleaned.length <= PRESENTATION_MAX_LENGTH) {
    return { description: cleaned, outcome: 'success' };
  }

  const head = cleaned.slice(0, PRESENTATION_MAX_LENGTH);
  const lastSentenceEnd = Math.max(
    head.lastIndexOf('.'),
    head.lastIndexOf('!'),
    head.lastIndexOf('?')
  );
  if (lastSentenceEnd > 0) {
    return {
      description: head.slice(0, lastSentenceEnd + 1).trim(),
      outcome: 'truncated',
    };
  }

  const lastSpace = head.lastIndexOf(' ', PRESENTATION_MAX_LENGTH - 1);
  const cut = lastSpace > 0 ? head.slice(0, lastSpace) : head.slice(0, -1);
  return { description: `${cut.trim()}…`, outcome: 'truncated' };
};
