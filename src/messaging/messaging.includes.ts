import { Includeable } from 'sequelize';
import { Media } from 'src/medias/models';
import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import {
  mediaAttributes,
  messageAttributes,
  conversationParticipantAttributes,
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
        {
          model: Media,
          as: 'medias',
          attributes: mediaAttributes,
          through: { attributes: [] },
        },
      ],
      attributes: messageAttributes,
      order: [['createdAt', 'DESC']],
      limit: limit,
      separate: true,
    },
    {
      model: User,
      as: 'participants',
      attributes: userAttributes,
      paranoid: false,
      through: {
        attributes: conversationParticipantAttributes,
        as: 'conversationParticipant',
      },
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
        through: {
          attributes: conversationParticipantAttributes,
          as: 'conversationParticipant',
        },
      },
    ],
  },
  {
    model: User,
    as: 'author',
    attributes: userAttributes,
    paranoid: false,
  },
  {
    model: Media,
    as: 'medias',
    attributes: mediaAttributes,
    through: { attributes: [] },
  },
];
