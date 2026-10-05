import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import type { PostDeletionReason, PostTitleSource } from '../posts.types';
import { User } from 'src/users/models';
import { PostContext } from './post-context.model';
import { PostReaction } from './post-reaction.model';
import { PostReply } from './post-reply.model';
import { PostRevision } from './post-revision.model';

/**
 * Generic publication. Today it is shown as a "discussion" of a help group
 * (through `PostContext`), but it is not tied to help groups so that it can
 * be reused elsewhere later (e.g. a global feed).
 */
@Table({ tableName: 'Posts' })
export class Post extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  authorId: string;

  // Nullable in DB since a feed post may not need one; required by help groups DTOs
  @AllowNull(true)
  @Column(DataType.STRING(120))
  title: string | null;

  @AllowNull(false)
  @Column(DataType.TEXT)
  content: string;

  @AllowNull(false)
  @Default('MANUAL')
  @Column(DataType.STRING(20))
  titleSource: PostTitleSource;

  // Date of the most recent visible reply, or the creation date
  @AllowNull(false)
  @Default(DataType.NOW)
  @Column
  lastActivityAt: Date;

  @AllowNull(true)
  @Column
  editedAt: Date | null;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  deletedById: string | null;

  // Only set by a moderation deletion (`deletedById` is then an admin)
  @AllowNull(true)
  @Column(DataType.STRING(30))
  deletionReason: PostDeletionReason | null;

  @AllowNull(true)
  @Column(DataType.STRING(500))
  deletionComment: string | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date | null;

  @BelongsTo(() => User, { foreignKey: 'authorId', constraints: false })
  author: User;

  @HasMany(() => PostContext, 'postId')
  contexts: PostContext[];

  @HasMany(() => PostReply, 'postId')
  replies: PostReply[];

  @HasMany(() => PostReaction, 'postId')
  reactions: PostReaction[];

  @HasMany(() => PostRevision, 'postId')
  revisions: PostRevision[];
}
