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
import type { PostDeletionReason } from '../posts.types';
import { User } from 'src/users/models';
import { PostReaction } from './post-reaction.model';
import { PostRevision } from './post-revision.model';
import { Post } from './post.model';

@Table({ tableName: 'PostReplies' })
export class PostReply extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => Post)
  @AllowNull(false)
  @Column
  postId: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  authorId: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  content: string;

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

  // Set by the automatic hiding after reports, cleared by an admin restoring
  // the message: only its author and the admins still read its content
  @AllowNull(true)
  @Column
  hiddenAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date | null;

  @BelongsTo(() => Post, 'postId')
  post: Post;

  @BelongsTo(() => User, { foreignKey: 'authorId', constraints: false })
  author: User;

  @HasMany(() => PostReaction, 'replyId')
  reactions: PostReaction[];

  @HasMany(() => PostRevision, 'replyId')
  revisions: PostRevision[];
}
