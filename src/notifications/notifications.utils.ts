import {
  NOTIFICATION_MAX_ACTOR_NAMES,
  NotificationEvent,
} from './notifications.types';

/**
 * "Amina", "Amina et Thomas", "Amina, Thomas et Sofia", then
 * "Amina, Thomas, Sofia et d'autres": never a number.
 */
export const formatActorNames = (firstNames: string[]): string => {
  if (firstNames.length > NOTIFICATION_MAX_ACTOR_NAMES) {
    return `${firstNames
      .slice(0, NOTIFICATION_MAX_ACTOR_NAMES)
      .join(', ')} et d'autres`;
  }
  if (firstNames.length <= 1) {
    return firstNames[0] ?? '';
  }
  return `${firstNames.slice(0, -1).join(', ')} et ${
    firstNames[firstNames.length - 1]
  }`;
};

/**
 * Distinct actors of the events, in the order of their first event.
 */
export const getDistinctActorIds = (events: NotificationEvent[]): string[] =>
  Array.from(new Set(sortEvents(events).map(({ actorId }) => actorId)));

export const sortEvents = (events: NotificationEvent[]): NotificationEvent[] =>
  [...events].sort((a, b) => a.at.localeCompare(b.at));

export const getLastEventAt = (events: NotificationEvent[]): Date =>
  new Date(Math.max(...events.map(({ at }) => new Date(at).getTime())));

export const areAllEventsSeen = (events: NotificationEvent[]): boolean =>
  events.every(({ seenAt }) => !!seenAt);

export const EXCERPT_MAX_LENGTH = 140;

export const toExcerpt = (text: string, maxLength = EXCERPT_MAX_LENGTH) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > maxLength
    ? `${flat.slice(0, maxLength).trimEnd()}…`
    : flat;
};
