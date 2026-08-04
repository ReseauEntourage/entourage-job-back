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
  'feedbackRating',
  'feedbackDate',
];

export const messageAttributes = ['id', 'content', 'createdAt', 'authorId'];
export const userProfileAttributes = ['id', 'unavailableAt', 'hasPicture'];
export const mediaAttributes = ['id', 'mimeType', 'name', 'size', 's3Key'];
