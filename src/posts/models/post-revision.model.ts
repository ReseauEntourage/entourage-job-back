import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { User } from 'src/users/models';
import { PostReply } from './post-reply.model';
import { Post } from './post.model';

/**
 * Previous version of an edited post or reply, saved at each edit. The
 * current version stays in the main row. A revision belongs to exactly one
 * of a post or a reply (DB CHECK constraint).
 */
@Table({ tableName: 'PostRevisions', updatedAt: false })
export class PostRevision extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

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

  // Only set for a post revision
  @AllowNull(true)
  @Column(DataType.STRING(120))
  title: string | null;

  @AllowNull(false)
  @Column(DataType.TEXT)
  content: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  editedById: string | null;

  @CreatedAt
  createdAt: Date;

  @BelongsTo(() => Post, 'postId')
  post: Post;

  @BelongsTo(() => PostReply, 'replyId')
  reply: PostReply;
}
