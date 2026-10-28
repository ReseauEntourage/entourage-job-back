import {
  MailjetTemplate,
  MailjetTemplates,
} from 'src/external-services/mailjet/mailjet.types';

/**
 * Stable label of an email in the communication history: the name of its
 * Mailjet template, or its numeric id when the template is not referenced.
 */
export const getEmailCommunicationType = (
  templateId: MailjetTemplate
): string =>
  Object.entries(MailjetTemplates).find(([, id]) => id === templateId)?.[0] ??
  String(templateId);

/**
 * Indexes, among the sent messages, of those the provider accepted. Mailjet
 * answers one `Status` per message, in the order of the request; any other
 * answer shape (a 2xx without detail) is read as every message accepted.
 */
export const getAcceptedMessageIndexes = (
  sendResult: unknown,
  messageCount: number
): number[] => {
  const messages = (sendResult as { body?: { Messages?: unknown } } | undefined)
    ?.body?.Messages;
  const all = Array.from({ length: messageCount }, (_, index) => index);

  if (!Array.isArray(messages) || messages.length !== messageCount) {
    return all;
  }

  return all.filter(
    (index) => (messages[index] as { Status?: string })?.Status === 'success'
  );
};

/**
 * Id Mailjet gave to the `index`-th message of a send: the `MessageID` of its
 * first recipient (`To[0]`), the one the user is addressed by. Undefined when
 * the answer does not detail it (no body, sandbox mode, copies only...).
 */
export const getMailjetMessageId = (
  sendResult: unknown,
  index: number
): string | undefined => {
  const messages = (sendResult as { body?: { Messages?: unknown } } | undefined)
    ?.body?.Messages;
  const messageId = (
    Array.isArray(messages)
      ? (messages[index] as { To?: { MessageID?: number | string }[] })
      : undefined
  )?.To?.[0]?.MessageID;

  return messageId === undefined || messageId === null
    ? undefined
    : String(messageId);
};
