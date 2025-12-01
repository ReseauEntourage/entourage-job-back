import { AdminZone } from 'src/utils/types';
import { getZoneSuffix } from './getZoneFromDepartment';

export enum Context {
  MAIN = 'main',
  COMPANY = 'company',
}

export function getLocalBranchMailsFromZone(
  zone: AdminZone,
  context: Context = Context.MAIN
) {
  const zoneSuffix = getZoneSuffix(zone);

  const mailMails = {
    moderationMail: process.env[`MAIN_MODERATION_MAIL_${zoneSuffix}`],
    referralMail: process.env[`MAIN_REFERRAL_MAIL_${zoneSuffix}`],
  };

  const companyMails = {
    moderationMail: process.env[`COMPANY_MODERATION_MAIL_${zoneSuffix}`],
    referralMail: process.env[`COMPANY_REFERRAL_MAIL_${zoneSuffix}`],
  };

  return context === Context.COMPANY ? companyMails : mailMails;
}
