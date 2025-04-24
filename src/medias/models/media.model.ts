import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, MaxLength, MinLength } from 'class-validator';
import {
  AfterFind,
  AllowNull,
  BelongsToMany,
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
import { S3Service } from 'src/external-services/aws/s3.service';
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

  @Column(DataType.VIRTUAL)
  signedUrl!: string;

  @AfterFind
  static async generateSignedUrl(media: Media | Media[]) {
    if (!Array.isArray(media)) {
      media = [media];
    }

    const s3Service = new S3Service();

    for (const item of media) {
      item.signedUrl = await s3Service.getSignedUrl(
        item.s3Key,
        item.mimeType,
        'inline' // Permit to display the file directly in the browser
      );
    }
  }
}
