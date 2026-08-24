import { ApiProperty } from '@nestjs/swagger';
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
import { Media } from 'src/medias/models';
import { UserProfile } from 'src/user-profiles/models/user-profile.model';

/**
 * Links a candidate's `UserProfile` to the `Media` holding one uploaded CV file.
 *
 * Every upload creates a new row: previous rows are never overwritten, so a
 * profile's CV history is the full set of its rows. The *current* CV is simply
 * the most recently created row with `deletedAt = null` — there is no explicit
 * "current" pointer.
 *
 * Soft-delete invariant (see also `Media.deletedAt`):
 * - `ExternalCv.deletedAt` means "this link is no longer active". It is set
 *   either when the candidate removes their CV (S3 and `Media` untouched), or
 *   in cascade when the referenced `Media` is actually deleted from S3.
 * - `Media.deletedAt` set ⇒ every referencing `ExternalCv.deletedAt` must be
 *   set. The reverse does NOT hold.
 */
@Table({ tableName: 'ExternalCvs' })
export class ExternalCv extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsUUID(4)
  @ForeignKey(() => UserProfile)
  @AllowNull(false)
  @Column
  userProfileId: string;

  @ApiProperty()
  @IsUUID(4)
  @ForeignKey(() => Media)
  @AllowNull(false)
  @Column
  mediaId: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date;

  @BelongsTo(() => Media, 'mediaId')
  media: Media;

  @BelongsTo(() => UserProfile, 'userProfileId')
  userProfile: UserProfile;
}
