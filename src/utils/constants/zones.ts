import { SfLocalBranchName } from '../types/local-branches.types';
import { Zone, ZoneName, ZoneSuffix } from '../types/zones.types';

const awsS3Url = process.env.AWSS3_URL || '';
const awsS3ImageDir = process.env.AWSS3_IMAGE_DIRECTORY || '';
const imageBasePath = `${awsS3Url}${awsS3ImageDir}`;

export const Zones: { [key in ZoneName]: Zone } = {
  [ZoneName.IDF]: {
    name: ZoneName.IDF,
    sfLocalBranchNames: [SfLocalBranchName.PARIS],
    suffix: ZoneSuffix.PARIS,
    staffContact: {
      main: {
        name: 'Clothilde B.',
        img: `${imageBasePath}staff-pictures/clothilde.jpg`,
        email: process.env.STAFF_CONTACT_MAIN_EMAIL_PARIS,
        slackEmail: process.env.STAFF_CONTACT_MAIN_SLACK_EMAIL_PARIS,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${imageBasePath}staff-pictures/pauline.jpg`,
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_PARIS,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_PARIS,
      },
    },
  },
  [ZoneName.AURA]: {
    name: ZoneName.AURA,
    sfLocalBranchNames: [SfLocalBranchName.LYON],
    suffix: ZoneSuffix.LYON,
    staffContact: {
      main: {
        name: 'Alice D.',
        img: `${imageBasePath}staff-pictures/alice.jpg`,
        email: process.env.STAFF_CONTACT_MAIN_EMAIL_LYON,
        slackEmail: process.env.STAFF_CONTACT_MAIN_SLACK_EMAIL_LYON,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${imageBasePath}staff-pictures/pauline.jpg`,
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_LYON,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_LYON,
      },
    },
  },
  [ZoneName.NORD]: {
    name: ZoneName.NORD,
    sfLocalBranchNames: [SfLocalBranchName.LILLE],
    suffix: ZoneSuffix.LILLE,
    staffContact: {
      main: {
        name: 'Julien D.',
        img: `${imageBasePath}staff-pictures/julien.png`,
        email: process.env.STAFF_CONTACT_MAIN_EMAIL_LILLE,
        slackEmail: process.env.STAFF_CONTACT_MAIN_SLACK_EMAIL_LILLE,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${imageBasePath}staff-pictures/pauline.jpg`,
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_LILLE,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_LILLE,
      },
    },
  },
  [ZoneName.BRETAGNE]: {
    name: ZoneName.BRETAGNE,
    sfLocalBranchNames: [SfLocalBranchName.RENNES],
    suffix: ZoneSuffix.RENNES,
    staffContact: {
      main: {
        name: 'Mathilde G.',
        img: `${imageBasePath}staff-pictures/mathilde.jpg`,
        email: process.env.STAFF_CONTACT_MAIN_EMAIL_RENNES,
        slackEmail: process.env.STAFF_CONTACT_MAIN_SLACK_EMAIL_RENNES,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${imageBasePath}staff-pictures/pauline.jpg`,
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_RENNES,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_RENNES,
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
      main: {
        name: 'Mathilde G.',
        img: `${imageBasePath}staff-pictures/mathilde.jpg`,
        email: process.env.STAFF_CONTACT_MAIN_EMAIL_RENNES,
        slackEmail: process.env.STAFF_CONTACT_MAIN_SLACK_EMAIL_RENNES,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${imageBasePath}staff-pictures/pauline.jpg`,
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_RENNES,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_RENNES,
      },
    },
  },
  [ZoneName.SUDOUEST]: {
    name: ZoneName.SUDOUEST,
    sfLocalBranchNames: [SfLocalBranchName.BORDEAUX],
    suffix: ZoneSuffix.SUDOUEST,
    staffContact: {
      main: {
        name: 'Valentine R.',
        img: `${imageBasePath}staff-pictures/valentine.jpg`,
        email: process.env.STAFF_CONTACT_MAIN_EMAIL_SUDOUEST,
        slackEmail: process.env.STAFF_CONTACT_MAIN_SLACK_EMAIL_SUDOUEST,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${imageBasePath}staff-pictures/pauline.jpg`,
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_SUDOUEST,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_SUDOUEST,
      },
    },
  },
  [ZoneName.HZ]: {
    name: ZoneName.HZ,
    sfLocalBranchNames: [SfLocalBranchName.HZ],
    suffix: ZoneSuffix.HZ,
    staffContact: {
      main: {
        name: 'Valentine R.',
        img: `${imageBasePath}staff-pictures/valentine.jpg`,
        email: process.env.STAFF_CONTACT_MAIN_EMAIL_HZ,
        slackEmail: process.env.STAFF_CONTACT_MAIN_SLACK_EMAIL_HZ,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${imageBasePath}staff-pictures/pauline.jpg`,
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_HZ,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_HZ,
      },
    },
  },
};
