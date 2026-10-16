import {
  AllowNull,
  BelongsTo,
  BelongsToMany,
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
import { Post, PostContext } from 'src/posts/models';
import { User } from 'src/users/models';
import { HelpGroupMembership } from './help-group-membership.model';

/**
 * States: unpublished (`publishedAt` null), published, deleted (`deletedAt` set).
 * Deleting a group does not cascade on its discussions: their visibility
 * derives from the group state.
 */
@Table({ tableName: 'HelpGroups' })
export class HelpGroup extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column(DataType.STRING(80))
  name: string;

  // Set once at creation, never changed nor reassigned (even when deleted)
  @AllowNull(false)
  @Column(DataType.STRING(100))
  slug: string;

  @AllowNull(false)
  @Column(DataType.STRING(500))
  description: string;

  @AllowNull(true)
  @Column
  publishedAt: Date | null;

  @AllowNull(true)
  @Column
  pinnedAt: Date | null;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(true)
  @Column
  createdById: string | null;

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

  @BelongsTo(() => User, { foreignKey: 'createdById', constraints: false })
  createdBy: User;

  @HasMany(() => HelpGroupMembership, 'groupId')
  memberships: HelpGroupMembership[];

  @BelongsToMany(() => Post, {
    through: () => PostContext,
    foreignKey: 'helpGroupId',
    otherKey: 'postId',
  })
  posts: Post[];
}
