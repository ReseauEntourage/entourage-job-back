import {
  AllowNull,
  BelongsTo,
  BelongsToMany,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  IsUUID,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Contracts } from 'src/common/contracts/contracts.types';
import { Skill } from 'src/common/skills/models';
import { Company } from 'src/companies/models/company.model';
import { WrapperModel } from 'src/utils/types';
import { RecruitementAlertBusinessSector } from './recruitement-alert-business-sector.model';
import { RecruitementAlertSkill } from './recruitement-alert-skill.model';

@Table({ tableName: 'RecruitementAlerts', timestamps: true })
export class RecruitementAlert extends WrapperModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column
  jobName: string;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  workingExperienceYears: number;

  @AllowNull(true)
  @Column(DataType.ENUM(...Object.values(Contracts)))
  contractType: Contracts;

  @IsUUID(4)
  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: string;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => RecruitementAlertBusinessSector, {
    foreignKey: 'recruitementAlertId',
    as: 'recruitementAlertBusinessSectors',
  })
  recruitementAlertBusinessSectors?: RecruitementAlertBusinessSector[];

  @BelongsToMany(
    () => BusinessSector,
    () => RecruitementAlertBusinessSector,
    'recruitementAlertId',
    'businessSectorId'
  )
  businessSectors?: BusinessSector[];

  @HasMany(() => RecruitementAlertSkill, {
    foreignKey: 'recruitementAlertId',
    as: 'recruitementAlertSkills',
  })
  recruitementAlertSkills?: RecruitementAlertSkill[];

  @BelongsToMany(
    () => Skill,
    () => RecruitementAlertSkill,
    'recruitementAlertId',
    'skillId'
  )
  skills?: Skill[];
}
