import { ReportTargetType } from './reports.types';

/**
 * Page of a reported target in the "Signalements" admin tab, linked from
 * every Slack moderation alert.
 */
export const getReportTargetAdminUrl = (
  targetType: ReportTargetType,
  targetId: string
) =>
  `${process.env.FRONT_URL}/backoffice/admin/signalements/${targetType}/${targetId}`;

export const REPORT_TARGET_SLACK_ACTION_LABEL = 'Voir la fiche';
