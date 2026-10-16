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
  UpdatedAt,
} from 'sequelize-typescript';
import { Post } from './post.model';

/**
 * Links a post to the place where it is shown. `helpGroupId` is the only
 * context column today; a future context adds its own nullable FK column.
 * The `HelpGroup` association is declared on the help-groups side to keep
 * this module independent from it.
 */
@Table({ tableName: 'PostContexts' })
export class PostContext extends Model {
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
  @AllowNull(true)
  @Column
  helpGroupId: string | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Post, 'postId')
  post: Post;
}
