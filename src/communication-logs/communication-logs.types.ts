export const CommunicationChannels = {
  EMAIL: 'email',
  SMS: 'sms',
} as const;

export type CommunicationChannel =
  (typeof CommunicationChannels)[keyof typeof CommunicationChannels];

/**
 * Identifiers of the entities related to a communication, keyed by their role
 * (e.g. `{ authorId: '<uuid>' }`). It only holds identifiers: never message
 * content, email addresses or phone numbers.
 */
export type CommunicationMetadata = Record<string, string>;

export interface CommunicationLogEntry {
  channel: CommunicationChannel;
  metadata?: CommunicationMetadata;
  /** Id the provider gave to the message, when it communicated one */
  providerMessageId?: string;
  type: string;
  userId: string;
}
