import { AdminZone } from 'src/utils/types';

export type MailerRecruitementAlert = {
  alertId: string;
  alertName: string;
  newCandidatesCount: number;
  companyAdminEmail: string;
  firstName: string;
  zone: AdminZone;
};
