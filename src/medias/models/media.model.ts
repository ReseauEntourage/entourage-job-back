import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, MaxLength, MinLength } from 'class-validator';
import {
  AllowNull,
  BelongsToMany,
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
import { Message, MessageMedia } from 'src/messaging/models';
import { User } from 'src/users/models';

@Table({ tableName: 'Medias' })
export class Media extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  /**
   * Set if and only if the underlying S3 object has actually been deleted.
   * It must never be set to merely "unlink" a media from the feature that
   * references it (see `ExternalCv.deletedAt` for that meaning).
   */
  @DeletedAt
  deletedAt: Date;

  @ApiProperty()
  @IsString()
  @AllowNull(false)
  @MinLength(1)
  @MaxLength(512)
  @Column
  name: string;

  @IsString()
  @AllowNull(false)
  @Column
  s3Key: string;

  @IsString()
  @AllowNull(false)
  @Column
  mimeType: string;

  @ApiProperty()
  @IsNumber()
  @AllowNull(false)
  @Column
  size: number;

  @ApiProperty()
  @IsString()
  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: string;

  @BelongsToMany(() => Message, () => MessageMedia)
  message?: Message;

  /**
   * Short-lived URL letting the client fetch the S3 object directly.
   *
   * Deliberately not filled by a model hook: it is only meaningful for medias
   * served to the client, and signing on every read would both waste work on
   * internal reads and bypass dependency injection. Callers that expose medias
   * fill it through `MediasService.attachSignedUrls`.
   */
  @Column(DataType.VIRTUAL)
  signedUrl!: string;
}
