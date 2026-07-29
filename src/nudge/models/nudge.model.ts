import {
  AllowNull,
  Column,
  DataType,
  Default,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

@Table({ tableName: 'Nudges', timestamps: false })
export class Nudge extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  value: string;

  @AllowNull(false)
  @Column
  nameRequest: string;

  @AllowNull(false)
  @Column
  nameOffer: string;

  @AllowNull(false)
  @Default(-1)
  @Column
  order: number;
}
