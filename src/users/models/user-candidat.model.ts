import {
  AllowNull,
  BeforeCreate,
  BeforeUpdate,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

import { User } from './user.model';
/*
  // lie un coach un utilisateur à son nouveau coach et délie un coach à son ancien user
  function clearCoachBindings(coachId: string) {
    return UserCandidat.update(
      { coachId: null },
      {
        where: { coachId },
      },
    );
  }
*/

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

  @BelongsTo(() => User, {
    foreignKey: 'candidatId',
    hooks: true,
    onDelete: 'CASCADE',
  })
  candidat: User;

  @BelongsTo(() => User, 'coachId')
  coach: User;

  /*@HasMany(() => CV, {
      /!*sourceKey: 'candidatId',*!/
      foreignKey: 'UserId',
    })
  cvs: CV[];*/

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

  /*@BeforeUpdate
  static async beforeUpdate(userCandidat: UserCandidat) {
    const nextData = userCandidat.dataValues;
    const previousData = userCandidat._previousDataValues;
    if (
      nextData &&
      previousData &&
      nextData.coachId &&
      nextData.coachId !== previousData.coachId
    ) {
      await clearCoachBindings(nextData.coachId);
    }
  }*/
}
