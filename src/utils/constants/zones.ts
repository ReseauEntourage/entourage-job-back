import { SfLocalBranchName } from '../types/local-branches.types';
import { Zone, ZoneName, ZoneSuffix } from '../types/zones.types';

const awsS3Url = process.env.AWSS3_URL || '';
const awsS3ImageDir = process.env.AWSS3_IMAGE_DIRECTORY || '';
const imageBasePath = `${awsS3Url}${awsS3ImageDir}`;

export const Zones: { [key in ZoneName]: Zone } = {
  [ZoneName.PARIS]: {
    name: ZoneName.PARIS,
    sfName: ZoneName.PARIS,
    suffix: ZoneSuffix.PARIS,
    departmentCodes: [],
    sfLocalBranches: [SfLocalBranchName.NATIONAL, SfLocalBranchName.PARIS],
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
  [ZoneName.LYON]: {
    name: ZoneName.LYON,
    sfName: ZoneName.LYON,
    suffix: ZoneSuffix.LYON,
    departmentCodes: [],
    sfLocalBranches: [SfLocalBranchName.NATIONAL, SfLocalBranchName.LYON],
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
  [ZoneName.LILLE]: {
    name: ZoneName.LILLE,
    sfName: ZoneName.LILLE,
    suffix: ZoneSuffix.LILLE,
    departmentCodes: [],
    sfLocalBranches: [SfLocalBranchName.NATIONAL, SfLocalBranchName.LILLE],
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
  [ZoneName.LORIENT]: {
    name: ZoneName.LORIENT,
    sfName: ZoneName.LORIENT,
    suffix: ZoneSuffix.LORIENT,
    departmentCodes: [],
    sfLocalBranches: [SfLocalBranchName.NATIONAL, SfLocalBranchName.LORIENT],
    staffContact: {
      main: {
        name: 'Mathilde G.',
        img: `${imageBasePath}staff-pictures/mathilde.jpg`,
        email: process.env.STAFF_CONTACT_MAIN_EMAIL_LORIENT,
        slackEmail: process.env.STAFF_CONTACT_MAIN_SLACK_EMAIL_LORIENT,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${imageBasePath}staff-pictures/pauline.jpg`,
        email: process.env.STAFF_CONTACT_COMPANIES_EMAIL_LORIENT,
        slackEmail: process.env.STAFF_CONTACT_COMPANIES_SLACK_EMAIL_LORIENT,
      },
    },
  },
  [ZoneName.RENNES]: {
    name: ZoneName.RENNES,
    sfName: ZoneName.RENNES,
    suffix: ZoneSuffix.RENNES,
    departmentCodes: [],
    sfLocalBranches: [SfLocalBranchName.NATIONAL, SfLocalBranchName.RENNES],
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
    sfName: ZoneName.HZ, // Salesforce uses 'HZ' for 'SUDOUEST'
    suffix: ZoneSuffix.SUDOUEST,
    departmentCodes: [],
    sfLocalBranches: [
      SfLocalBranchName.NATIONAL,
      SfLocalBranchName.BORDEAUX,
      SfLocalBranchName.NANTES,
    ],
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
    sfName: ZoneName.HZ,
    suffix: ZoneSuffix.HZ,
    departmentCodes: [],
    sfLocalBranches: [SfLocalBranchName.NATIONAL, SfLocalBranchName.HZ],
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
