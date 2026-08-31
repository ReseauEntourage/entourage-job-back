export const userAttributes = [
  'id',
  'firstName',
  'lastName',
  'email',
  'gender',
  'role',
  'zone',
  'elearningCompletedAt',
];

export const userAttributesWithDeletedAt = [...userAttributes, 'deletedAt'];

export const conversationParticipantAttributes = [
  'id',
  'seenAt',
  'createdAt',
  'updatedAt',
];

export const messageAttributes = [
  'id',
  'content',
  'createdAt',
  'authorId',
  'type',
  'serviceMessageKind',
  'metadata',
];
export const userProfileAttributes = ['id', 'unavailableAt', 'hasPicture'];
export const mediaAttributes = ['id', 'mimeType', 'name', 'size', 's3Key'];
