import { ApiProperty } from '@nestjs/swagger';
import {
  AllowNull,
  BeforeCreate,
  BeforeUpdate,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

import { CV } from 'src/cvs/models';
import { User } from './user.model';

@Table({ tableName: 'User_Candidats' })
export class UserCandidat extends Model {
  @IsUUID(4)
  @PrimaryKey
  @ForeignKey(() => User)
  @Column
  candidatId: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @Column({ allowNull: true })
  coachId: string;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  employed: boolean;

  @ApiProperty()
  @AllowNull(true)
  @Column
  contract: string;

  @ApiProperty()
  @AllowNull(true)
  @Column(DataType.DATEONLY)
  endOfContract: Date;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  hidden: boolean;

  @ApiProperty()
  @AllowNull(true)
  @Column
  note: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  url: string;

  @ApiProperty()
  @IsUUID(4)
  @AllowNull(true)
  @Column
  lastModifiedBy: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => User, {
    foreignKey: 'candidatId',
    hooks: true,
  })
  candidat: User;

  @BelongsTo(() => User, 'coachId')
  coach: User;

  @HasMany(() => CV, {
    sourceKey: 'candidatId',
    foreignKey: 'UserId',
  })
  cvs: CV[];

  @BeforeCreate
  @BeforeUpdate
  static async generateUrl(userCandidat: UserCandidat) {
    const user = await User.findByPk(userCandidat.candidatId, {
      attributes: ['id', 'firstName'],
    });
    userCandidat.url = `${user.firstName.toLowerCase()}-${user.id.substring(
      0,
      8
    )}`;
  }

  @BeforeUpdate
  static async clearCoachBindings(userCandidatToUpdate: UserCandidat) {
    const previousUserCandidatValues = userCandidatToUpdate.previous();
    if (
      userCandidatToUpdate &&
      previousUserCandidatValues &&
      userCandidatToUpdate.coachId &&
      previousUserCandidatValues.coachId
    ) {
      await UserCandidat.update(
        { coachId: null },
        {
          where: { coachId: userCandidatToUpdate.coachId },
        }
      );
    }
  }
}
