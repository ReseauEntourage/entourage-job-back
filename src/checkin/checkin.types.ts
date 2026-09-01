export enum CheckinStillInTouch {
  NO_MADE_ROUND = 'NO_MADE_ROUND',
  NO_TOO_BAD = 'NO_TOO_BAD',
  YES = 'YES',
}

export enum CheckinExchangeMode {
  ENTOURAGE_PRO_MESSAGES = 'ENTOURAGE_PRO_MESSAGES',
  IN_PERSON = 'IN_PERSON',
  OTHER = 'OTHER',
  OUTSIDE_MESSAGES = 'OUTSIDE_MESSAGES',
  PHONE = 'PHONE',
  VIDEO = 'VIDEO',
}

export enum CheckinExchangeFrequency {
  MONTHLY = 'MONTHLY',
  MORE_THAN_WEEKLY = 'MORE_THAN_WEEKLY',
  ONE_OFF = 'ONE_OFF',
  TWICE_A_MONTH = 'TWICE_A_MONTH',
  WEEKLY = 'WEEKLY',
}

// Candidate-only options, in addition to the shared NOTHING_YET / OTHER below.
export enum CheckinPerceivedBenefitCandidate {
  BUILD_PROFESSIONAL_PROJECT = 'BUILD_PROFESSIONAL_PROJECT',
  CONCRETE_ADVICE = 'CONCRETE_ADVICE',
  DYNAMIZE_NETWORK = 'DYNAMIZE_NETWORK',
  FIND_JOB_INTERNSHIP_OR_APPRENTICESHIP = 'FIND_JOB_INTERNSHIP_OR_APPRENTICESHIP',
  FIND_TRAINING = 'FIND_TRAINING',
  IDENTIFY_OPPORTUNITIES = 'IDENTIFY_OPPORTUNITIES',
  METHODOLOGICAL_SUPPORT = 'METHODOLOGICAL_SUPPORT',
  MORAL_SUPPORT = 'MORAL_SUPPORT',
  WORK_ON_POSTURE = 'WORK_ON_POSTURE',
}

// Coach-only options, in addition to the shared NOTHING_YET / OTHER below.
export enum CheckinPerceivedBenefitCoach {
  FEELING_USEFUL = 'FEELING_USEFUL',
  LISTENING_AND_POSTURE_SKILLS = 'LISTENING_AND_POSTURE_SKILLS',
  MEANING_IN_PROFESSIONAL_LIFE = 'MEANING_IN_PROFESSIONAL_LIFE',
  MEANINGFUL_HUMAN_ENCOUNTER = 'MEANINGFUL_HUMAN_ENCOUNTER',
  NEW_PERSPECTIVE_ON_OBSTACLES = 'NEW_PERSPECTIVE_ON_OBSTACLES',
  WISH_TO_GET_MORE_INVOLVED = 'WISH_TO_GET_MORE_INVOLVED',
}

// Shared across roles. NOTHING_YET is the mutually-exclusive option (labelled
// "Rien de concret pour l'instant" for candidates, "Rien de particulier pour
// l'instant" for coaches).
export enum CheckinPerceivedBenefitShared {
  NOTHING_YET = 'NOTHING_YET',
  OTHER = 'OTHER',
}

export const CheckinPerceivedBenefit = {
  ...CheckinPerceivedBenefitCandidate,
  ...CheckinPerceivedBenefitCoach,
  ...CheckinPerceivedBenefitShared,
};
export type CheckinPerceivedBenefit =
  | CheckinPerceivedBenefitCandidate
  | CheckinPerceivedBenefitCoach
  | CheckinPerceivedBenefitShared;

export enum CheckinEmploymentType {
  APPRENTICESHIP = 'APPRENTICESHIP',
  CIVIC_SERVICE = 'CIVIC_SERVICE',
  INTERNSHIP = 'INTERNSHIP',
  JOB = 'JOB',
}

export enum CheckinPerceivedSupport {
  DONT_KNOW = 'DONT_KNOW',
  NOT_AT_ALL = 'NOT_AT_ALL',
  YES_A_BIT = 'YES_A_BIT',
  YES_A_LOT = 'YES_A_LOT',
}

export const CHECKIN_ELIGIBILITY_THRESHOLD_DAYS = 30;

// One relance, 7 days after the initial invitation — see messaging-lifecycle-mailers.
export const CHECKIN_RELANCE_THRESHOLD_DAYS = 37;

// Human-readable French labels, used to format the full checkin for staff-facing
// surfaces (e.g. the Slack alert sent to a staffContact). Mirrors the labels shown to
// the user in entourage-job-front's src/constants/checkin.ts.
export const CHECKIN_STILL_IN_TOUCH_LABELS: Record<
  CheckinStillInTouch,
  string
> = {
  [CheckinStillInTouch.YES]: 'Oui',
  [CheckinStillInTouch.NO_MADE_ROUND]: 'Non, nous avons fait le tour',
  [CheckinStillInTouch.NO_TOO_BAD]: 'Non, et c’est dommage',
};

export const CHECKIN_EXCHANGE_MODE_LABELS: Record<CheckinExchangeMode, string> =
  {
    [CheckinExchangeMode.ENTOURAGE_PRO_MESSAGES]:
      'Par messages sur Entourage Pro',
    [CheckinExchangeMode.OUTSIDE_MESSAGES]:
      'Par messages en dehors d’Entourage',
    [CheckinExchangeMode.PHONE]: 'Par téléphone',
    [CheckinExchangeMode.VIDEO]: 'En visio',
    [CheckinExchangeMode.IN_PERSON]: 'En présentiel',
    [CheckinExchangeMode.OTHER]: 'Autre',
  };

export const CHECKIN_EXCHANGE_FREQUENCY_LABELS: Record<
  CheckinExchangeFrequency,
  string
> = {
  [CheckinExchangeFrequency.MORE_THAN_WEEKLY]: 'Plus d’une fois par semaine',
  [CheckinExchangeFrequency.WEEKLY]: 'Environ une fois par semaine',
  [CheckinExchangeFrequency.TWICE_A_MONTH]: 'Deux fois par mois',
  [CheckinExchangeFrequency.MONTHLY]: 'Une fois par mois',
  [CheckinExchangeFrequency.ONE_OFF]: 'Un échange ponctuel, une seule fois',
};

export const CHECKIN_PERCEIVED_BENEFIT_LABELS: Record<
  CheckinPerceivedBenefit,
  string
> = {
  [CheckinPerceivedBenefitCandidate.DYNAMIZE_NETWORK]:
    'Dynamiser son réseau pro',
  [CheckinPerceivedBenefitCandidate.IDENTIFY_OPPORTUNITIES]:
    'Identifier des opportunités',
  [CheckinPerceivedBenefitCandidate.CONCRETE_ADVICE]:
    'Avoir des conseils concrets',
  [CheckinPerceivedBenefitCandidate.WORK_ON_POSTURE]: 'Travailler sa posture',
  [CheckinPerceivedBenefitCandidate.METHODOLOGICAL_SUPPORT]:
    'Avoir un soutien méthodologique',
  [CheckinPerceivedBenefitCandidate.MORAL_SUPPORT]: 'Avoir un soutien moral',
  [CheckinPerceivedBenefitCandidate.BUILD_PROFESSIONAL_PROJECT]:
    'Construire ou préciser son projet professionnel',
  [CheckinPerceivedBenefitCandidate.FIND_JOB_INTERNSHIP_OR_APPRENTICESHIP]:
    'Trouver un emploi, un stage ou une alternance',
  [CheckinPerceivedBenefitCandidate.FIND_TRAINING]: 'Trouver une formation',
  [CheckinPerceivedBenefitCoach.FEELING_USEFUL]: 'Le sentiment d’être utile',
  [CheckinPerceivedBenefitCoach.MEANINGFUL_HUMAN_ENCOUNTER]:
    'Une rencontre humaine qui compte',
  [CheckinPerceivedBenefitCoach.NEW_PERSPECTIVE_ON_OBSTACLES]:
    'Un autre regard sur les obstacles à l’emploi',
  [CheckinPerceivedBenefitCoach.LISTENING_AND_POSTURE_SKILLS]:
    'Des compétences d’écoute et de posture',
  [CheckinPerceivedBenefitCoach.MEANING_IN_PROFESSIONAL_LIFE]:
    'Du sens dans son quotidien professionnel',
  [CheckinPerceivedBenefitCoach.WISH_TO_GET_MORE_INVOLVED]:
    'L’envie de s’engager davantage',
  [CheckinPerceivedBenefitShared.NOTHING_YET]: 'Rien de concret pour l’instant',
  [CheckinPerceivedBenefitShared.OTHER]: 'Autre',
};

export const CHECKIN_EMPLOYMENT_TYPE_LABELS: Record<
  CheckinEmploymentType,
  string
> = {
  [CheckinEmploymentType.JOB]: 'Un emploi',
  [CheckinEmploymentType.INTERNSHIP]: 'Un stage',
  [CheckinEmploymentType.APPRENTICESHIP]: 'Une alternance',
  [CheckinEmploymentType.CIVIC_SERVICE]: 'Un service civique',
};

export const CHECKIN_PERCEIVED_SUPPORT_LABELS: Record<
  CheckinPerceivedSupport,
  string
> = {
  [CheckinPerceivedSupport.YES_A_LOT]: 'Oui, beaucoup',
  [CheckinPerceivedSupport.YES_A_BIT]: 'Oui, un peu',
  [CheckinPerceivedSupport.NOT_AT_ALL]: 'Non, pas du tout',
  [CheckinPerceivedSupport.DONT_KNOW]: 'Je ne sais pas',
};
