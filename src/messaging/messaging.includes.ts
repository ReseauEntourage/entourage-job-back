import { Includeable } from 'sequelize';
import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import {
  messageAttributes,
  userAttributes,
  userProfileAttributes,
} from './messaging.attributes';
import { Conversation, Message } from './models';

export const messagingParticipantsInclude: Includeable = {
  model: UserProfile,
  attributes: [...userProfileAttributes],
};

export const messagingConversationIncludes = (
  limit: number | undefined = undefined
): Includeable[] => {
  return [
    {
      model: Message,
      as: 'messages',
      include: [
        {
          model: User,
          as: 'author',
          paranoid: false,
          attributes: userAttributes,
        },
      ],
      attributes: messageAttributes,
      order: [['createdAt', 'DESC']],
      limit: limit,
    },
    {
      model: User,
      as: 'participants',
      paranoid: false,
      attributes: userAttributes,
      include: [messagingParticipantsInclude],
    },
  ];
};

export const messagingMessageIncludes: Includeable[] = [
  {
    model: Conversation,
    as: 'conversation',
    attributes: ['id'],
    include: [
      {
        model: User,
        as: 'participants',
        attributes: userAttributes,
        paranoid: false,
      },
    ],
  },
  {
    model: User,
    as: 'author',
    attributes: userAttributes,
    paranoid: false,
  },
];
