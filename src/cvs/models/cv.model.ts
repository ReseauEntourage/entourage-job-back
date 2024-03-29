import { ApiProperty } from '@nestjs/swagger';
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
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/business-lines/models';
import { Contract } from 'src/common/contracts/models';
import { Experience } from 'src/common/experiences/models/experience.model';
import { Formation } from 'src/common/formations/models/formation.model';
import { Language } from 'src/common/languages/models';
import { Location } from 'src/common/locations/models';
import { Passion } from 'src/common/passions/models';
import { Review } from 'src/common/reviews/models/review.model';
import { Skill } from 'src/common/skills/models';
import { UserCandidat } from 'src/users/models';
import { CVStatus, CVStatuses } from 'src/users/users.types';
import { CVAmbition } from './cv-ambition.model';
import { CVBusinessLine } from './cv-business-line.model';
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
  'formations',
] as const;

@Table({ tableName: 'CVs' })
export class CV extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsUUID(4)
  @ForeignKey(() => UserCandidat)
  @AllowNull(false)
  @Column
  UserId: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  urlImg: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  intro: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  story: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  availability: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  transport: string;

  @ApiProperty()
  @AllowNull(true)
  @Column
  catchphrase: string;

  @ApiProperty()
  @AllowNull(false)
  @Default(CVStatuses.NEW.value)
  @Column
  status: CVStatus;

  @ApiProperty()
  @AllowNull(false)
  @Default(1)
  @Column
  version: number;

  @ApiProperty()
  @IsUUID(4)
  @AllowNull(true)
  @Column
  lastModifiedBy: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt?: Date;

  @BelongsTo(() => UserCandidat, {
    foreignKey: 'UserId',
    targetKey: 'candidatId',
  })
  user: UserCandidat;

  @HasOne(() => CVSearch, 'CVId')
  cvSearch: CVSearch;

  @ApiProperty()
  @BelongsToMany(
    () => BusinessLine,
    () => CVBusinessLine,
    'CVId',
    'BusinessLineId'
  )
  businessLines: BusinessLine[];

  @HasMany(() => CVBusinessLine, 'CVId')
  cvBusinessLines: CVBusinessLine[];

  @ApiProperty()
  @BelongsToMany(() => Location, () => CVLocation, 'CVId', 'LocationId')
  locations: Location[];

  @HasMany(() => CVLocation, 'CVId')
  cvLocations: CVLocation[];

  @ApiProperty()
  @BelongsToMany(() => Ambition, () => CVAmbition, 'CVId', 'AmbitionId')
  ambitions: Ambition[];

  @HasMany(() => CVAmbition, 'CVId')
  cvAmbitions: CVAmbition[];

  @ApiProperty()
  @BelongsToMany(() => Contract, () => CVContract, 'CVId', 'ContractId')
  contracts: Contract[];

  @HasMany(() => CVContract, 'CVId')
  cvContracts: CVContract[];

  @ApiProperty()
  @BelongsToMany(() => Language, () => CVLanguage, 'CVId', 'LanguageId')
  languages: Language[];

  @HasMany(() => CVLanguage, 'CVId')
  cvLanguages: CVLanguage[];

  @ApiProperty()
  @BelongsToMany(() => Passion, () => CVPassion, 'CVId', 'PassionId')
  passions: Passion[];

  @HasMany(() => CVPassion, 'CVId')
  cvPassions: CVPassion[];

  @ApiProperty()
  @BelongsToMany(() => Skill, () => CVSkill, 'CVId', 'SkillId')
  skills: Skill[];

  @HasMany(() => CVSkill, 'CVId')
  cvSkills: CVSkill[];

  @ApiProperty()
  @HasMany(() => Experience, 'CVId')
  experiences: Experience[];

  @ApiProperty()
  @HasMany(() => Formation, 'CVId')
  formations: Formation[];

  @ApiProperty()
  @HasMany(() => Review, 'CVId')
  reviews: Review[];

  @AfterDestroy
  static async deleteRelations(destroyedCV: CV) {
    await Promise.all(
      CVAssociations.map(async (cvAssociation) => {
        const associationInstances = await destroyedCV.$get(cvAssociation);
        if (associationInstances) {
          if (Array.isArray(associationInstances)) {
            return Promise.all(
              associationInstances.map((assocationInstance) => {
                return assocationInstance.destroy();
              })
            );
          } else {
            return associationInstances.destroy();
          }
        }
      })
    );
  }
}
