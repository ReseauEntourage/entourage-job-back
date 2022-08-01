import {
  AllowNull,
  BeforeCreate,
  BelongsTo,
  BelongsToMany,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { v4 as uuid } from 'uuid';
import { BusinessLine } from 'src/businessLines';
import { UserCandidat } from 'src/users';
import { CVBusinessLine } from './cv-businessLine.model';
import { CVStatusValue, CVStatuses } from './cv.types';

@Table({ tableName: 'CVs' })
export class CV extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ForeignKey(() => UserCandidat)
  @AllowNull(false)
  @Column
  UserId: string;

  @AllowNull(true)
  @Column
  urlImg: string;

  @AllowNull(true)
  @Column
  intro: string;

  @AllowNull(true)
  @Column
  story: string;

  @AllowNull(true)
  @Column
  availability: string;

  @AllowNull(true)
  @Column
  transport: string;

  @AllowNull(true)
  @Column
  catchphrase: string;

  @AllowNull(false)
  /*@Default(CVStatuses.New.value)*/
  @Column
  status: CVStatusValue;

  @AllowNull(false)
  @Default(1)
  @Column
  version: number;

  @IsUUID(4)
  @AllowNull(true)
  @Column
  lastModifiedBy: string;

  @BelongsTo(() => UserCandidat, {
    foreignKey: 'UserId',
    targetKey: 'candidatId',
  })
  user: UserCandidat;

  @BelongsToMany(
    () => BusinessLine,
    () => CVBusinessLine,
    'CVId',
    'BusinessLineId'
  )
  businessLines: BusinessLine[];

  @HasMany(() => CVBusinessLine, {
    onDelete: 'CASCADE',
    foreignKey: 'CVId',
  })
  cvBusinessLines: CVBusinessLine[];

  /*
// TODO check if useful
CV.belongsToMany(models.Ambition, {
  through: 'CV_Ambitions',
  as: 'ambitions',
});

CV.hasMany(models.CV_Ambition, {
  as: 'cvAmbitions',
  onDelete: 'CASCADE',
});

// TODO check if useful
CV.belongsToMany(models.Contract, {
  through: 'CV_Contracts',
  as: 'contracts',
});

CV.hasMany(models.CV_Contract, {
  as: 'cvContracts',
  onDelete: 'CASCADE',
});

// TODO check if useful
CV.belongsToMany(models.Language, {
  through: 'CV_Language',
  as: 'languages',
});

CV.hasMany(models.CV_Language, {
  as: 'cvLanguages',
  onDelete: 'CASCADE',
});

// TODO check if useful
CV.belongsToMany(models.Passion, {
  through: 'CV_Passions',
  as: 'passions',
});

CV.hasMany(models.CV_Passion, {
  as: 'cvPassions',
  onDelete: 'CASCADE',
});

CV.belongsToMany(models.BusinessLine, {
  through: 'CV_BusinessLines',
  as: 'businessLines',
});

// TODO check if useful
CV.belongsToMany(models.Skill, {
  through: 'CV_Skills',
  as: 'skills',
});

CV.hasMany(models.CV_Skill, {
  as: 'cvSkills',
  onDelete: 'CASCADE',
});

CV.belongsToMany(models.Location, {
  through: 'CV_Locations',
  as: 'locations',
});
CV.hasMany(models.CV_Locations, {
  as: 'cvLocations',
  onDelete: 'CASCADE',
});

CV.hasMany(models.Experience, {
  as: 'experiences',
  onDelete: 'CASCADE',
});

CV.hasMany(models.Review, {
  as: 'reviews',
  onDelete: 'CASCADE',
});

CV.hasOne(models.CV_Search, {
  as: 'cvSearch',
  foreignKey: 'CVId',
  sourceKey: 'id',
  onDelete: 'CASCADE',
});

CV.afterDestroy(paranoidDeleteCascade(models));
*/
}
