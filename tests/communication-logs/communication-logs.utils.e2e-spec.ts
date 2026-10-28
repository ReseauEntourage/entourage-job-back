import {
  getAcceptedMessageIndexes,
  getEmailCommunicationType,
  getMailjetMessageId,
} from 'src/communication-logs/communication-logs.utils';
import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';

describe('communication logs utils', () => {
  describe('getEmailCommunicationType', () => {
    it('returns the name of the Mailjet template', () => {
      expect(getEmailCommunicationType(MailjetTemplates.ACCOUNT_CREATED)).toBe(
        'ACCOUNT_CREATED'
      );
    });

    it('falls back to the numeric id of an unknown template', () => {
      expect(getEmailCommunicationType(987654321 as never)).toBe('987654321');
    });
  });

  describe('getAcceptedMessageIndexes', () => {
    it('keeps only the messages Mailjet answered with a success status', () => {
      const result = {
        body: {
          Messages: [{ Status: 'success' }, { Status: 'error' }],
        },
      };

      expect(getAcceptedMessageIndexes(result, 2)).toEqual([0]);
    });

    it.each([
      ['no answer detail', undefined],
      ['no Messages in the body', { body: {} }],
      ['a different number of answers', { body: { Messages: [] } }],
    ])('reads %s as every message accepted', (_label, result) => {
      expect(getAcceptedMessageIndexes(result, 2)).toEqual([0, 1]);
    });
  });

  describe('getMailjetMessageId', () => {
    const result = {
      body: {
        Messages: [
          {
            Status: 'success',
            To: [{ MessageID: 1152921515, MessageUUID: 'uuid-1' }],
            Cc: [{ MessageID: 99 }],
          },
          { Status: 'success', To: [] as { MessageID: number }[] },
        ],
      },
    };

    it('returns the MessageID of the first recipient as a string', () => {
      expect(getMailjetMessageId(result, 0)).toBe('1152921515');
    });

    it.each([
      ['a message without recipient detail', result, 1],
      ['a message missing from the answer', result, 2],
      ['no answer detail', undefined, 0],
      ['no Messages in the body', { body: {} }, 0],
    ])('returns undefined for %s', (_label, sendResult, index) => {
      expect(getMailjetMessageId(sendResult, index)).toBeUndefined();
    });
  });
});
