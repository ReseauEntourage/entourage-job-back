import { Includeable, Op, WhereOptions } from 'sequelize';
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
import { MessageCursor } from './messaging.utils';
import { Conversation, Message } from './models';

export const messagingParticipantsInclude: Includeable = {
  model: UserProfile,
  attributes: [...userProfileAttributes],
};

export interface MessagingConversationIncludesOptions {
  after?: MessageCursor;
  before?: MessageCursor;
  limit?: number;
}

const buildMessagesCursorWhere = (
  options: MessagingConversationIncludesOptions
): WhereOptions | undefined => {
  const { before, after } = options;
  if (before) {
    return {
      [Op.or]: [
        { createdAt: { [Op.lt]: before.createdAt } },
        { createdAt: before.createdAt, id: { [Op.lt]: before.id } },
      ],
    };
  }
  if (after) {
    return {
      [Op.or]: [
        { createdAt: { [Op.gt]: after.createdAt } },
        { createdAt: after.createdAt, id: { [Op.gt]: after.id } },
      ],
    };
  }
  return undefined;
};

export const messagingConversationIncludes = (
  options: MessagingConversationIncludesOptions = {}
): Includeable[] => {
  // With a `limit`, order determines which messages the cutoff keeps.
  // `before`/no-cursor: DESC correctly keeps the messages nearest the
  // cursor (the most recent). `after` needs the opposite — ASC keeps the
  // ones nearest the cursor (the oldest of the "new" ones); DESC would
  // instead keep only the very latest messages, silently dropping a gap
  // of older-but-still-new ones in between. The caller (`getConversationById`)
  // reverses the result back to the conversation's DESC-everywhere-else
  // convention when `after` was used.
  const order: [string, 'ASC' | 'DESC'][] = options.after
    ? [
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ]
    : [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ];
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
      where: buildMessagesCursorWhere(options),
      order,
      limit: options.limit,
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
    attributes: ['id', 'type'],
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
