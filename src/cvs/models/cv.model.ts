import {
  AfterDestroy,
  AllowNull,
  BelongsTo,
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  HasMany,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { CVStatusValue, CVStatuses } from '../cvs.types';
import { BusinessLine } from 'src/businessLines';
import { Location } from 'src/locations';
import { UserCandidat } from 'src/users';
import { CVBusinessLine } from './cv-businessLine.model';
import { CVLocation } from './cv-location.model';

const CVAssociations = ['cvBusinessLines', 'cvLocations'] as const;

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
  @Default(CVStatuses.New.value)
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

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date;

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

  @BelongsToMany(() => Location, () => CVLocation, 'CVId', 'LocationId')
  locations: Location[];

  @HasMany(() => CVLocation, {
    onDelete: 'CASCADE',
    foreignKey: 'CVId',
  })
  cvLocations: CVLocation[];

  @AfterDestroy
  static async deleteRelations(destroyedCV: CV) {
    await Promise.all(
      CVAssociations.map(async (cvAssociation) => {
        const associationInstances = await destroyedCV.$get(cvAssociation);
        return Promise.all(
          associationInstances.map(async (assocationInstance) => {
            return assocationInstance.destroy();
          })
        );
      })
    );
  }

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
