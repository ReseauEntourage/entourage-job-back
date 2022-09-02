import { ApiProperty } from '@nestjs/swagger';
import * as _ from 'lodash';
import {
  AfterUpdate,
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
import { OfferStatus, OfferStatuses } from '../opportunities.types';
import { getMailjetVariablesForPrivateOrPublicOffer } from '../opportunities.utils';
import { User, UserAttributes } from 'src/users/models';
import { UserCandidatInclude } from 'src/users/models/user.include';
import { getAdminMailsFromZone } from 'src/utils/misc';
import { HistorizedModel } from 'src/utils/types';
import { Opportunity } from './opportunity.model';

@Table({ tableName: 'Opportunity_Users' })
export class OpportunityUser extends HistorizedModel {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @IsUUID(4)
  @ForeignKey(() => Opportunity)
  @AllowNull(false)
  @Column
  OpportunityId: string;

  @IsUUID(4)
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  UserId: string;

  @ApiProperty()
  @AllowNull(false)
  @Default(OfferStatuses.toProcess)
  @Column
  status: OfferStatus;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  seen: boolean;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  bookmarked: boolean;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  archived: boolean;

  @ApiProperty()
  @AllowNull(false)
  @Default(false)
  @Column
  recommended: boolean;

  @ApiProperty()
  @AllowNull(true)
  @Column
  note: string;

  @BelongsTo(() => User, 'UserId')
  user: User;

  @AfterUpdate
  // TODO put in controller
  static async sendStatusUpdatedMail(updatedOpportunityUser: OpportunityUser) {
    const previousOpportunityUserValues = updatedOpportunityUser.previous();
    if (
      updatedOpportunityUser &&
      previousOpportunityUserValues &&
      previousOpportunityUserValues.status &&
      updatedOpportunityUser.status !== OfferStatuses.contacted.value
    ) {
      /*
      const [candidat, offer] = await Promise.all([
        User.findByPk(updatedOpportunityUser.UserId, {
          attributes: [...UserAttributes],
          include: UserCandidatInclude,
        }),
        Opportunity.findByPk(updatedOpportunityUser.OpportunityId),
      ]);

      const mailVariables = {
        candidat: _.omitBy(candidat.toJSON(), _.isNil),
        offer: getMailjetVariablesForPrivateOrPublicOffer(
          offer.toJSON(),
          updatedOpportunityUser.status,
          false
        ),
      };

      const { candidatesAdminMail } = getAdminMailsFromZone(candidat.zone);

      await addToWorkQueue({
        type: JOBS.JOB_TYPES.SEND_MAIL,
        toEmail: candidatesAdminMail,
        templateId: MAILJET_TEMPLATES.STATUS_CHANGED,
        variables: mailVariables,
      });

      if (
        updatedOpportunityUser.status ===
          OfferStatuses.refusalBeforeInterview.value &&
        !offer.isPublic &&
        !offer.isExternal
      ) {
        const { companiesAdminMail } = getAdminMailsFromDepartment(
          offer.department
        );

        await addToWorkQueue({
          type: JOBS.JOB_TYPES.SEND_MAIL,
          toEmail: offer.contactMail || offer.recruiterMail,
          replyTo: companiesAdminMail,
          templateId: MAILJET_TEMPLATES.OFFER_REFUSED,
          variables: mailVariables,
        });
      }*/
    }
  }
}
