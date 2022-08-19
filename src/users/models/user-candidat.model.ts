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

  @AllowNull(false)
  @Default(false)
  @Column
  employed: boolean;

  @AllowNull(true)
  @Column
  contract: string;

  @AllowNull(true)
  @Column(DataType.DATEONLY)
  endOfContract: Date;

  @AllowNull(false)
  @Default(false)
  @Column
  hidden: boolean;

  @AllowNull(true)
  @Column
  note: string;

  @AllowNull(true)
  @Column
  url: string;

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
  static async clearCoachBindings(nextUserCandidat: UserCandidat) {
    const previousUserCandidatValues = nextUserCandidat.previous();
    if (
      nextUserCandidat &&
      previousUserCandidatValues &&
      nextUserCandidat.coachId &&
      previousUserCandidatValues.coachId
    ) {
      await UserCandidat.update(
        { coachId: null },
        {
          where: { coachId: nextUserCandidat.coachId },
        }
      );
    }
  }
}
