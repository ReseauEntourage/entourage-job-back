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
  HasOne,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { Ambition } from 'src/ambitions/models';
import { BusinessLine } from 'src/businessLines/models';
import { Contract } from 'src/contracts/models';
import { Experience } from 'src/experiences/models/experience.model';
import { Language } from 'src/languages/models';
import { Location } from 'src/locations/models';
import { Passion } from 'src/passions/models';
import { Review } from 'src/reviews/models/review.model';
import { Skill } from 'src/skills/models';
import { UserCandidat } from 'src/users/models';
import { CVStatuses, CVStatusValue } from 'src/users/users.types';
import { CVAmbition } from './cv-ambition.model';
import { CVBusinessLine } from './cv-businessLine.model';
import { CVContract } from './cv-contract.model';
import { CVLanguage } from './cv-language.model';
import { CVLocation } from './cv-location.model';
import { CVPassion } from './cv-passion.model';
import { CVSearch } from './cv-search.model';
import { CVSkill } from './cv-skill.model';

const CVAssociations = [
  'cvBusinessLines',
  'cvLocations',
  'cvAmbitions',
  'cvContracts',
  'cvLanguages',
  'cvPassions',
  'cvSkills',
  'cvSearch',
  'reviews',
  'experiences',
] as const;

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

  @HasOne(() => CVSearch, 'CVId')
  cvSearch: CVSearch;

  @BelongsToMany(
    () => BusinessLine,
    () => CVBusinessLine,
    'CVId',
    'BusinessLineId'
  )
  businessLines: BusinessLine[];

  @HasMany(() => CVBusinessLine, {
    foreignKey: 'CVId',
  })
  cvBusinessLines: CVBusinessLine[];

  @BelongsToMany(() => Location, () => CVLocation, 'CVId', 'LocationId')
  locations: Location[];

  @HasMany(() => CVLocation, {
    foreignKey: 'CVId',
  })
  cvLocations: CVLocation[];

  @BelongsToMany(() => Ambition, () => CVAmbition, 'CVId', 'AmbitionId')
  ambitions: Ambition[];

  @HasMany(() => CVAmbition, {
    foreignKey: 'CVId',
  })
  cvAmbitions: CVAmbition[];

  @BelongsToMany(() => Contract, () => CVContract, 'CVId', 'ContractId')
  contracts: Contract[];

  @HasMany(() => CVContract, {
    foreignKey: 'CVId',
  })
  cvContracts: CVContract[];

  @BelongsToMany(() => Language, () => CVLanguage, 'CVId', 'LanguageId')
  languages: Language[];

  @HasMany(() => CVLanguage, {
    foreignKey: 'CVId',
  })
  cvLanguages: CVLanguage[];

  @BelongsToMany(() => Passion, () => CVPassion, 'CVId', 'PassionId')
  passions: Passion[];

  @HasMany(() => CVPassion, {
    foreignKey: 'CVId',
  })
  cvPassions: CVPassion[];

  @BelongsToMany(() => Skill, () => CVSkill, 'CVId', 'SkillId')
  skills: Skill[];

  @HasMany(() => CVSkill, {
    foreignKey: 'CVId',
  })
  cvSkills: CVSkill[];

  @HasMany(() => Experience, {
    foreignKey: 'CVId',
  })
  experiences: Experience[];

  @HasMany(() => Review, {
    foreignKey: 'CVId',
  })
  reviews: Review[];

  @AfterDestroy
  static async deleteRelations(destroyedCV: CV) {
    await Promise.all(
      CVAssociations.map(async (cvAssociation) => {
        const associationInstances = await destroyedCV.$get(cvAssociation);
        if (Array.isArray(associationInstances)) {
          return Promise.all(
            associationInstances.map(async (assocationInstance) => {
              return assocationInstance.destroy();
            })
          );
        } else {
          return associationInstances.destroy();
        }
      })
    );
  }
}
