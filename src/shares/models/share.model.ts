import {
  AllowNull,
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
import { UserCandidat } from 'src/users/models';

// TODO change name to Searches
@Table({ tableName: 'Shares' })
export class Share extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

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
