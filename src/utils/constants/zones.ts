import { SfLocalBranchName } from '../types/local-branches.types';
import { Zone, ZoneName, ZoneSuffix } from '../types/zones.types';

export const Zones: { [key in ZoneName]: Zone } = {
  [ZoneName.PARIS]: {
    name: ZoneName.PARIS,
    suffix: ZoneSuffix.PARIS,
    departmentCodes: [],
    sfLocalBranches: [SfLocalBranchName.NATIONAL, SfLocalBranchName.PARIS],
    referral: {
      main: {
        name: 'Clothilde B.',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/clothilde.jpg`,
        email: process.env.REFERRAL_MAIN_EMAIL_PARIS,
        slackEmail: process.env.REFERRAL_MAIN_SLACK_EMAIL_PARIS,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/pauline.jpg`,
        email: process.env.REFERRAL_COMPANIES_EMAIL_PARIS,
        slackEmail: process.env.REFERRAL_COMPANIES_SLACK_EMAIL_PARIS,
      },
    },
  },
  [ZoneName.LYON]: {
    name: ZoneName.LYON,
    suffix: ZoneSuffix.LYON,
    departmentCodes: [],
    sfLocalBranches: [SfLocalBranchName.NATIONAL, SfLocalBranchName.LYON],
    referral: {
      main: {
        name: 'Alice D.',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}/referrals-pictures/alice.jpg`,
        email: process.env.REFERRAL_MAIN_EMAIL_LYON,
        slackEmail: process.env.REFERRAL_MAIN_SLACK_EMAIL_LYON,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/pauline.jpg`,
        email: process.env.REFERRAL_COMPANIES_EMAIL_LYON,
        slackEmail: process.env.REFERRAL_COMPANIES_SLACK_EMAIL_LYON,
      },
    },
  },
  [ZoneName.LILLE]: {
    name: ZoneName.LILLE,
    suffix: ZoneSuffix.LILLE,
    departmentCodes: [],
    sfLocalBranches: [SfLocalBranchName.NATIONAL, SfLocalBranchName.LILLE],
    referral: {
      main: {
        name: 'Julien D.',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/julien.png`,
        email: process.env.REFERRAL_MAIN_EMAIL_LILLE,
        slackEmail: process.env.REFERRAL_MAIN_SLACK_EMAIL_LILLE,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/pauline.jpg`,
        email: process.env.REFERRAL_COMPANIES_EMAIL_LILLE,
        slackEmail: process.env.REFERRAL_COMPANIES_SLACK_EMAIL_LILLE,
      },
    },
  },
  [ZoneName.LORIENT]: {
    name: ZoneName.LORIENT,
    suffix: ZoneSuffix.LORIENT,
    departmentCodes: [],
    sfLocalBranches: [SfLocalBranchName.NATIONAL, SfLocalBranchName.LORIENT],
    referral: {
      main: {
        name: 'Mathilde G.',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/mathilde.jpg`,
        email: process.env.REFERRAL_MAIN_EMAIL_LORIENT,
        slackEmail: process.env.REFERRAL_MAIN_SLACK_EMAIL_LORIENT,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/pauline.jpg`,
        email: process.env.REFERRAL_COMPANIES_EMAIL_LORIENT,
        slackEmail: process.env.REFERRAL_COMPANIES_SLACK_EMAIL_LORIENT,
      },
    },
  },
  [ZoneName.RENNES]: {
    name: ZoneName.RENNES,
    suffix: ZoneSuffix.RENNES,
    departmentCodes: [],
    sfLocalBranches: [SfLocalBranchName.NATIONAL, SfLocalBranchName.RENNES],
    referral: {
      main: {
        name: 'Mathilde G.',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/mathilde.jpg`,
        email: process.env.REFERRAL_MAIN_EMAIL_RENNES,
        slackEmail: process.env.REFERRAL_MAIN_SLACK_EMAIL_RENNES,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/pauline.jpg`,
        email: process.env.REFERRAL_COMPANIES_EMAIL_RENNES,
        slackEmail: process.env.REFERRAL_COMPANIES_SLACK_EMAIL_RENNES,
      },
    },
  },
  [ZoneName.SUDOUEST]: {
    name: ZoneName.SUDOUEST,
    suffix: ZoneSuffix.SUDOUEST,
    departmentCodes: [],
    sfLocalBranches: [
      SfLocalBranchName.NATIONAL,
      SfLocalBranchName.BORDEAUX,
      SfLocalBranchName.NANTES,
    ],
    referral: {
      main: {
        name: 'Valentine R.',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/valentine.jpg`,
        email: process.env.REFERRAL_MAIN_EMAIL_SUDOUEST,
        slackEmail: process.env.REFERRAL_MAIN_SLACK_EMAIL_SUDOUEST,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/pauline.jpg`,
        email: process.env.REFERRAL_COMPANIES_EMAIL_SUDOUEST,
        slackEmail: process.env.REFERRAL_COMPANIES_SLACK_EMAIL_SUDOUEST,
      },
    },
  },
  [ZoneName.HZ]: {
    name: ZoneName.HZ,
    suffix: ZoneSuffix.HZ,
    departmentCodes: [],
    sfLocalBranches: [SfLocalBranchName.NATIONAL, SfLocalBranchName.HZ],
    referral: {
      main: {
        name: 'Valentine R.',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/valentine.jpg`,
        email: process.env.REFERRAL_MAIN_EMAIL_HZ,
        slackEmail: process.env.REFERRAL_MAIN_SLACK_EMAIL_HZ,
      },
      company: {
        name: 'Pauline de Kergal',
        img: `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}referrals-pictures/pauline.jpg`,
        email: process.env.REFERRAL_COMPANIES_EMAIL_HZ,
        slackEmail: process.env.REFERRAL_COMPANIES_SLACK_EMAIL_HZ,
      },
    },
  },
};
