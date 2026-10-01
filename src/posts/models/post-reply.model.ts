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
import { User } from 'src/users/models';
import { PostReaction } from './post-reaction.model';
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
}
