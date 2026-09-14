import { SfLocalBranchName } from '../types/local-branches.types';
import { Zone, ZoneName, ZoneSuffix } from '../types/zones.types';

// Read lazily (not at module top-level): AppModule's ConfigModule.forRoot()
// loads the .env file, but zones.ts is transitively imported (via feature
// modules) before that call runs, so process.env would still be empty here.
const getImageBasePath = () =>
  `${process.env.AWSS3_URL || ''}${process.env.AWSS3_IMAGE_DIRECTORY || ''}`;

export const Zones: { [key in ZoneName]: Zone } = {
  [ZoneName.IDF]: {
    name: ZoneName.IDF,
    sfLocalBranchNames: [SfLocalBranchName.PARIS],
    suffix: ZoneSuffix.PARIS,
    staffContact: {
      candidate: {
        name: 'Clothilde',
        get img() {
          return `${getImageBasePath()}staff-pictures/clothilde.jpg`;
        },
        email: process.env.STAFF_CONTACT_CANDIDATE_EMAIL_PARIS,
        slackEmail: process.env.STAFF_CONTACT_CANDIDATE_SLACK_EMAIL_PARIS,
        entourageProEmail:
          process.env.STAFF_CONTACT_CANDIDATE_ENTOURAGE_PRO_EMAIL_PARIS,
      },
      coach: {
        name: 'Adèle',
        get img() {
          return `${getImageBasePath()}staff-pictures/adele.jpg`;
        },
        email: process.env.STAFF_CONTACT_COACH_EMAIL_PARIS,
        slackEmail: process.env.STAFF_CONTACT_COACH_SLACK_EMAIL_PARIS,
        entourageProEmail:
          process.env.STAFF_CONTACT_COACH_ENTOURAGE_PRO_EMAIL_PARIS,
      },
      company: {
        name: 'Pauline',
        get img() {
          return `${getImageBasePath()}staff-pictures/pauline.jpg`;
        },
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_PARIS,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_PARIS,
        entourageProEmail:
          process.env.STAFF_CONTACT_COMPANIES_ENTOURAGE_PRO_EMAIL_PARIS,
      },
    },
  },
  [ZoneName.AURA]: {
    name: ZoneName.AURA,
    sfLocalBranchNames: [SfLocalBranchName.LYON],
    suffix: ZoneSuffix.LYON,
    staffContact: {
      candidate: {
        name: 'Alice',
        get img() {
          return `${getImageBasePath()}staff-pictures/alice.jpg`;
        },
        email: process.env.STAFF_CONTACT_CANDIDATE_EMAIL_LYON,
        slackEmail: process.env.STAFF_CONTACT_CANDIDATE_SLACK_EMAIL_LYON,
        entourageProEmail:
          process.env.STAFF_CONTACT_CANDIDATE_ENTOURAGE_PRO_EMAIL_LYON,
      },
      coach: {
        name: 'Gabriella',
        get img() {
          return `${getImageBasePath()}staff-pictures/gabriella.jpg`;
        },
        email: process.env.STAFF_CONTACT_COACH_EMAIL_LYON,
        slackEmail: process.env.STAFF_CONTACT_COACH_SLACK_EMAIL_LYON,
        entourageProEmail:
          process.env.STAFF_CONTACT_COACH_ENTOURAGE_PRO_EMAIL_LYON,
      },
      company: {
        name: 'Pauline',
        get img() {
          return `${getImageBasePath()}staff-pictures/pauline.jpg`;
        },
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_LYON,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_LYON,
        entourageProEmail:
          process.env.STAFF_CONTACT_COMPANIES_ENTOURAGE_PRO_EMAIL_LYON,
      },
    },
  },
  [ZoneName.NORD]: {
    name: ZoneName.NORD,
    sfLocalBranchNames: [SfLocalBranchName.LILLE],
    suffix: ZoneSuffix.LILLE,
    staffContact: {
      candidate: {
        name: 'Julien',
        get img() {
          return `${getImageBasePath()}staff-pictures/julien.png`;
        },
        email: process.env.STAFF_CONTACT_CANDIDATE_EMAIL_LILLE,
        slackEmail: process.env.STAFF_CONTACT_CANDIDATE_SLACK_EMAIL_LILLE,
        entourageProEmail:
          process.env.STAFF_CONTACT_CANDIDATE_ENTOURAGE_PRO_EMAIL_LILLE,
      },
      coach: {
        name: 'Julien',
        get img() {
          return `${getImageBasePath()}staff-pictures/julien.png`;
        },
        email: process.env.STAFF_CONTACT_COACH_EMAIL_LILLE,
        slackEmail: process.env.STAFF_CONTACT_COACH_SLACK_EMAIL_LILLE,
        entourageProEmail:
          process.env.STAFF_CONTACT_COACH_ENTOURAGE_PRO_EMAIL_LILLE,
      },
      company: {
        name: 'Pauline',
        get img() {
          return `${getImageBasePath()}staff-pictures/pauline.jpg`;
        },
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_LILLE,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_LILLE,
        entourageProEmail:
          process.env.STAFF_CONTACT_COMPANIES_ENTOURAGE_PRO_EMAIL_LILLE,
      },
    },
  },
  [ZoneName.BRETAGNE]: {
    name: ZoneName.BRETAGNE,
    sfLocalBranchNames: [SfLocalBranchName.RENNES],
    suffix: ZoneSuffix.RENNES,
    staffContact: {
      candidate: {
        name: 'Mathilde',
        get img() {
          return `${getImageBasePath()}staff-pictures/mathilde.jpg`;
        },
        email: process.env.STAFF_CONTACT_CANDIDATE_EMAIL_RENNES,
        slackEmail: process.env.STAFF_CONTACT_CANDIDATE_SLACK_EMAIL_RENNES,
        entourageProEmail:
          process.env.STAFF_CONTACT_CANDIDATE_ENTOURAGE_PRO_EMAIL_RENNES,
      },
      coach: {
        name: 'Mathilde',
        get img() {
          return `${getImageBasePath()}staff-pictures/mathilde.jpg`;
        },
        email: process.env.STAFF_CONTACT_COACH_EMAIL_RENNES,
        slackEmail: process.env.STAFF_CONTACT_COACH_SLACK_EMAIL_RENNES,
        entourageProEmail:
          process.env.STAFF_CONTACT_COACH_ENTOURAGE_PRO_EMAIL_RENNES,
      },
      company: {
        name: 'Pauline',
        get img() {
          return `${getImageBasePath()}staff-pictures/pauline.jpg`;
        },
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_RENNES,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_RENNES,
        entourageProEmail:
          process.env.STAFF_CONTACT_COMPANIES_ENTOURAGE_PRO_EMAIL_RENNES,
      },
    },
  },

  // To be removed in the future, in favor of Bretagne zone but can't be done now
  // due to the fact that only the zone is stored in DB and we need a local branch
  // to sync in Salesforce
  [ZoneName.LORIENT]: {
    name: ZoneName.LORIENT,
    sfLocalBranchNames: [SfLocalBranchName.LORIENT],
    suffix: ZoneSuffix.RENNES,
    staffContact: {
      candidate: {
        name: 'Mathilde',
        get img() {
          return `${getImageBasePath()}staff-pictures/mathilde.jpg`;
        },
        email: process.env.STAFF_CONTACT_CANDIDATE_EMAIL_RENNES,
        slackEmail: process.env.STAFF_CONTACT_CANDIDATE_SLACK_EMAIL_RENNES,
        entourageProEmail:
          process.env.STAFF_CONTACT_CANDIDATE_ENTOURAGE_PRO_EMAIL_RENNES,
      },
      coach: {
        name: 'Mathilde',
        get img() {
          return `${getImageBasePath()}staff-pictures/mathilde.jpg`;
        },
        email: process.env.STAFF_CONTACT_COACH_EMAIL_RENNES,
        slackEmail: process.env.STAFF_CONTACT_COACH_SLACK_EMAIL_RENNES,
        entourageProEmail:
          process.env.STAFF_CONTACT_COACH_ENTOURAGE_PRO_EMAIL_RENNES,
      },
      company: {
        name: 'Pauline',
        get img() {
          return `${getImageBasePath()}staff-pictures/pauline.jpg`;
        },
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_RENNES,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_RENNES,
        entourageProEmail:
          process.env.STAFF_CONTACT_COMPANIES_ENTOURAGE_PRO_EMAIL_RENNES,
      },
    },
  },
  [ZoneName.SUDOUEST]: {
    name: ZoneName.SUDOUEST,
    sfLocalBranchNames: [SfLocalBranchName.BORDEAUX],
    suffix: ZoneSuffix.SUDOUEST,
    staffContact: {
      candidate: {
        name: 'Auguste',
        get img() {
          return `${getImageBasePath()}staff-pictures/auguste.jpg`;
        },
        email: process.env.STAFF_CONTACT_CANDIDATE_EMAIL_SUDOUEST,
        slackEmail: process.env.STAFF_CONTACT_CANDIDATE_SLACK_EMAIL_SUDOUEST,
        entourageProEmail:
          process.env.STAFF_CONTACT_CANDIDATE_ENTOURAGE_PRO_EMAIL_SUDOUEST,
      },
      coach: {
        name: 'Auguste',
        get img() {
          return `${getImageBasePath()}staff-pictures/auguste.jpg`;
        },
        email: process.env.STAFF_CONTACT_COACH_EMAIL_SUDOUEST,
        slackEmail: process.env.STAFF_CONTACT_COACH_SLACK_EMAIL_SUDOUEST,
        entourageProEmail:
          process.env.STAFF_CONTACT_COACH_ENTOURAGE_PRO_EMAIL_SUDOUEST,
      },
      company: {
        name: 'Pauline',
        get img() {
          return `${getImageBasePath()}staff-pictures/pauline.jpg`;
        },
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_SUDOUEST,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_SUDOUEST,
        entourageProEmail:
          process.env.STAFF_CONTACT_COMPANIES_ENTOURAGE_PRO_EMAIL_SUDOUEST,
      },
    },
  },
  [ZoneName.HZ]: {
    name: ZoneName.HZ,
    sfLocalBranchNames: [SfLocalBranchName.HZ],
    suffix: ZoneSuffix.HZ,
    staffContact: {
      candidate: {
        name: 'Marine',
        get img() {
          return `${getImageBasePath()}staff-pictures/marine.jpg`;
        },
        email: process.env.STAFF_CONTACT_CANDIDATE_EMAIL_HZ,
        slackEmail: process.env.STAFF_CONTACT_CANDIDATE_SLACK_EMAIL_HZ,
        entourageProEmail:
          process.env.STAFF_CONTACT_CANDIDATE_ENTOURAGE_PRO_EMAIL_HZ,
      },
      coach: {
        name: 'Laure',
        get img() {
          return `${getImageBasePath()}staff-pictures/laure.jpg`;
        },
        email: process.env.STAFF_CONTACT_COACH_EMAIL_HZ,
        slackEmail: process.env.STAFF_CONTACT_COACH_SLACK_EMAIL_HZ,
        entourageProEmail:
          process.env.STAFF_CONTACT_COACH_ENTOURAGE_PRO_EMAIL_HZ,
      },
      company: {
        name: 'Pauline',
        get img() {
          return `${getImageBasePath()}staff-pictures/pauline.jpg`;
        },
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_HZ,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_HZ,
        entourageProEmail:
          process.env.STAFF_CONTACT_COMPANIES_ENTOURAGE_PRO_EMAIL_HZ,
      },
    },
  },
};

/**
 * "HORS ZONE" (HZ) is displayed as "National" rather than its literal zone
 * name — the enum value itself is not renamed (still stored/compared as
 * ZoneName.HZ everywhere else).
 */
export const getZoneDisplayLabel = (
  zone: ZoneName | string | null | undefined
): string => {
  const resolvedZone = zone || ZoneName.HZ;
  return resolvedZone === ZoneName.HZ ? 'National' : resolvedZone;
};
