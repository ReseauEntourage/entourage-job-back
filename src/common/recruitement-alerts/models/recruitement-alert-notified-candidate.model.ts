import { AllowNull, Column, Model, Table } from 'sequelize-typescript';

@Table({
  tableName: 'RecruitementAlertsNotifiedCandidates',
  timestamps: false,
})
export class RecruitementAlertNotifiedCandidate extends Model {
  @AllowNull(false)
  @Column({ primaryKey: true })
  recruitementAlertId: string;

  @AllowNull(false)
  @Column({ primaryKey: true })
  userId: string;
}
