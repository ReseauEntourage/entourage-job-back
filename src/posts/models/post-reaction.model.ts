import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from 'src/users/models';
import { PostReply } from './post-reply.model';
import { Post } from './post.model';

// Display order of the reactions palette
export const PostReactionEmojis = ['💪', '❤️', '👏', '🙌', '🎉'] as const;

export type PostReactionEmoji = (typeof PostReactionEmojis)[number];

/**
 * A reaction targets exactly one of a post or a reply (DB CHECK constraint).
 */
@Table({ tableName: 'PostReactions' })
export class PostReaction extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: string;

  @IsUUID(4)
  @ForeignKey(() => Post)
  @AllowNull(true)
  @Column
  postId: string | null;

  @IsUUID(4)
  @ForeignKey(() => PostReply)
  @AllowNull(true)
  @Column
  replyId: string | null;

  @AllowNull(false)
  @Column(DataType.STRING(8))
  emoji: PostReactionEmoji;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date | null;

  @BelongsTo(() => User, { foreignKey: 'userId', constraints: false })
  user: User;

  @BelongsTo(() => Post, 'postId')
  post: Post;

  @BelongsTo(() => PostReply, 'replyId')
  reply: PostReply;
}
