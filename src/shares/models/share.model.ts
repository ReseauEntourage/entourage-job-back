import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { UserCandidat } from 'src/users/models';
import { HistorizedModel } from 'src/utils/types';

@Table({ tableName: 'Shares' })
export class Share extends HistorizedModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => UserCandidat)
  @AllowNull(false)
  @Column
  CandidatId: string;

  @Default(0)
  @AllowNull(false)
  @Column
  facebook: number;

  @Default(0)
  @AllowNull(false)
  @Column
  twitter: number;

  @Default(0)
  @AllowNull(false)
  @Column
  linkedin: number;

  @Default(0)
  @AllowNull(false)
  @Column
  whatsapp: number;

  @Default(0)
  @AllowNull(false)
  @Column
  other: number;

  @BelongsTo(() => UserCandidat, {
    foreignKey: 'CandidatId',
    targetKey: 'candidatId',
  })
  candidat: UserCandidat;
}
