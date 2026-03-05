import { IsEnum, IsString, IsUUID } from 'class-validator';
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { UserProfile } from './user-profile.model';

export enum UserProfileEmbeddingType {
  profile = 'profile',
  needs = 'needs',
}

@Table({ tableName: 'UserProfileEmbeddings' })
export class UserProfileEmbedding extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @IsUUID(4)
  @ForeignKey(() => UserProfile)
  @AllowNull(false)
  @Column
  userProfileId: string;

  @IsEnum(UserProfileEmbeddingType)
  @AllowNull(false)
  @Column
  type: UserProfileEmbeddingType;

  @AllowNull(false)
  @Column({
    type: 'vector(1536)',
    validate: {
      isCorrectLength(value: number[]) {
        if (value && value.length !== 1536) {
          throw new Error('Embedding must have exactly 1536 dimensions');
        }
      },
    },
  })
  embedding: number[];

  @IsString()
  @AllowNull(false)
  @Column(DataType.STRING(50))
  configVersion: string;

  @BelongsTo(() => UserProfile, 'userProfileId')
  userProfile: UserProfile;
}
