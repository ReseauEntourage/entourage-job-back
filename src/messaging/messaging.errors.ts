export class ErrorMessagingNeedParticipantsOrConversationId extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorMessagingNeedParticipantsOrConversationId';
  }
}

export class ErrorMessagingCantParticipate extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ErrorMessagingCantParticipate';
  }
}

export class ErrorMessagingReachedDailyConversationLimit extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ErrorMessagingReachedDailyConversationLimit';
  }
}

export class ErrorMessagingInvalidMessage extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ErrorMessagingInvalidMessage';
  }
}

export class ErrorMessagingMailingListInvalid extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ErrorMessagingMailingListInvalid';
  }
}
