import { ZoneName } from 'src/utils/types/zones.types';

export type MailerRecruitementAlert = {
  alertId: string;
  alertName: string;
  newCandidatesCount: number;
  companyAdminEmail: string;
  firstName: string;
  zone: ZoneName;
};
