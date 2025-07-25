import {
  AllowNull,
  BelongsToMany,
  Column,
  DataType,
  Default,
  HasMany,
  IsUUID,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileContract } from 'src/user-profiles/models/user-profile-contract.model';
import { WrapperModel } from 'src/utils/types';

@Table({ tableName: 'Contracts', timestamps: false })
export class Contract extends WrapperModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: string;

  @HasMany(() => UserProfileContract, {
    foreignKey: 'contractId',
    as: 'userProfileContracts',
  })
  userProfileContracts?: UserProfileContract[];

  @BelongsToMany(() => UserProfile, () => UserProfileContract, 'contractId')
  userProfileId?: string;
}
