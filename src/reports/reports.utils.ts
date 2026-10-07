import type { SlackMsgAction } from 'src/external-services/slack/slack.types';
import {
  ReportResolution,
  ReportResolutions,
  ReportTargetType,
} from './reports.types';

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
// Kept on a moderation alert once its report is handled
export const REPORT_TARGET_SLACK_ACTION_VALUE = 'report-target';

const withQueryParam = (url: string, key: string, value: string) =>
  `${url}${url.includes('?') ? '&' : '?'}${key}=${value}`;

/**
 * "Voir la fiche", leading to the page of the target in the reports tab.
 */
export const getReportTargetSlackAction = (
  targetType: ReportTargetType,
  targetId: string
): SlackMsgAction => ({
  label: REPORT_TARGET_SLACK_ACTION_LABEL,
  url: getReportTargetAdminUrl(targetType, targetId),
  value: REPORT_TARGET_SLACK_ACTION_VALUE,
});

/**
 * The actions of an admin on a reported help group message, from Slack:
 * they open the message in its thread with the action ready, never run it.
 */
export const getGroupMessageModerationSlackActions = (
  messageUrl: string
): SlackMsgAction[] => [
  {
    label: 'Rétablir le message',
    url: withQueryParam(messageUrl, 'moderation', 'restore'),
    value: 'moderation-restore',
    style: 'primary',
  },
  {
    label: 'Supprimer le message',
    url: withQueryParam(messageUrl, 'moderation', 'delete'),
    value: 'moderation-delete',
    style: 'danger',
  },
];

/**
 * The action of an admin on a reported conversation or profile, from Slack:
 * the page of the target, with the closing form open.
 */
export const getResolveSlackAction = (
  targetType: ReportTargetType,
  targetId: string
): SlackMsgAction => ({
  label: 'Marquer comme traité',
  url: withQueryParam(
    getReportTargetAdminUrl(targetType, targetId),
    'action',
    'resolve'
  ),
  value: 'moderation-resolve',
  style: 'primary',
});

export const REPORT_RESOLUTION_SLACK_LABELS: {
  [K in ReportResolution]: string;
} = {
  [ReportResolutions.RESTORED]: 'message rétabli',
  [ReportResolutions.DELETED]: 'message supprimé',
  [ReportResolutions.MANUAL]: 'marqué comme traité',
};
