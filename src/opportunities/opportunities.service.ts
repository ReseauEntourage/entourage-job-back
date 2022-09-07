import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as _ from 'lodash';
import { Op } from 'sequelize';
import { BusinessLine } from '../businessLines/models';
import { ContactStatus, ContactStatuses } from '../mails/mails.types';
import { getZoneFromDepartment } from '../utils/misc';
import { AdminZone } from '../utils/types';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { Department } from 'src/locations/locations.types';
import { MailchimpService } from 'src/mails/mailchimp.service';
import { UsersService } from 'src/users/users.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { Opportunity, OpportunityUser } from './models';
import { OpportunityCompleteInclude } from './models/opportunity.include';
import { OpportunityUsersService } from './opportunity-users.service';

@Injectable()
export class OpportunitiesService {
  constructor(
    @InjectModel(Opportunity)
    private opportunityModel: typeof Opportunity,
    @InjectModel(OpportunityUser)
    private opportunityUserModel: typeof Opportunity,
    @InjectModel(BusinessLine)
    private businessLineModel: typeof BusinessLine,
    private mailchimpService: MailchimpService,
    private opportunityUsersService: OpportunityUsersService,
    private usersService: UsersService,
    private externalDatabasesService: ExternalDatabasesService
  ) {}

  async create(
    createOpportunityDto: Partial<Opportunity>,
    candidatesId?: string[],
    isAdmin = false,
    createdById?: string
  ) {
    const createdOpportunity = await Opportunity.create({
      ...createOpportunityDto,
      isValidated: !!isAdmin,
      createdBy: createdById,
    });

    if (createOpportunityDto.businessLines) {
      const businessLines = await Promise.all(
        createOpportunityDto.businessLines.map(({ name, order = -1 }) => {
          return this.businessLineModel.create({ name, order });
        })
      );
      await createdOpportunity.$add('businessLines', businessLines);
    }
    return createdOpportunity;
  }

  async findAllCandidateIdsToRecommendOfferTo(
    department: Department,
    businessLines: BusinessLine[]
  ) {
    if (department && businessLines?.length > 0) {
      const autoRecommendationsZone = process.env.AUTO_RECOMMENDATIONS_ZONE;
      if (
        !autoRecommendationsZone ||
        autoRecommendationsZone === getZoneFromDepartment(department)
      ) {
        const publishedCandidates =
          await this.usersService.findAllPublishedCandidatesByDepartmentAndBusinessLines(
            department,
            businessLines
          );

        return publishedCandidates.map(({ id }) => {
          return id;
        });
      }
    }
    return [] as string[];
  }

  findAll() {
    return `This action returns all opportunities`;
  }

  async findOne(id: string) {
    return this.opportunityModel.findByPk(id, {
      include: OpportunityCompleteInclude,
    });
  }

  async findOneAsCandidate(id: string, candidateId: string) {
    const opportunityUser =
      await this.opportunityUsersService.findOneByCandidateIdAndOpportunityId(
        candidateId,
        id
      );

    if (!opportunityUser) {
      return null;
    }

    return this.opportunityModel.findOne({
      where: { isValidated: true, isArchived: false, id },
    });
  }

  update(id: number, updateOpportunityDto: UpdateOpportunityDto) {
    return `This action updates a #${id} opportunity`;
  }

  remove(id: number) {
    return `This action removes a #${id} opportunity`;
  }

  async sendRecruitorMailToMailchimp(
    mail: string,
    zone: AdminZone | AdminZone[],
    contactStatus: ContactStatus
  ) {
    return this.mailchimpService.sendContact(mail, zone, contactStatus);
  }

  async sendMailsAfterCreation(
    opportunity: Opportunity,
    candidatesId: string[],
    isAdmin = false,
    shouldSendNotifications = true
  ) {
    let candidates: OpportunityUser[] = [];

    const candidateIdsToRecommendTo = opportunity.isPublic
      ? await this.findAllCandidateIdsToRecommendOfferTo(
          opportunity.department,
          opportunity.businessLines
        )
      : [];

    if (candidatesId?.length > 0 || candidateIdsToRecommendTo?.length > 0) {
      const uniqueCandidateIds = _.uniq([
        ...(candidatesId || []),
        ...(candidateIdsToRecommendTo || []),
      ]);

      await Promise.all(
        uniqueCandidateIds.map((candidateId) => {
          return this.opportunityUsersService.create({
            OpportunityId: opportunity.id,
            UserId: candidateId,
            recommended: opportunity.isPublic,
          });
        })
      );

      candidates =
        await this.opportunityUsersService.findAllByCandidateIdsAndOpportunityId(
          uniqueCandidateIds,
          opportunity.id
        );

      /* if (!isAdmin) {
        await sendOnCreatedOfferMessages(candidates, opportunity);
      } else {
        await sendOnValidatedOfferMessages(opportunity);
        if (shouldSendNotifications) {
          await sendCandidateOfferMessages(candidates, opportunity);
        }
      }*/
    }

    await this.sendRecruitorMailToMailchimp(
      opportunity.contactMail || opportunity.recruiterMail,
      getZoneFromDepartment(opportunity.department),
      ContactStatuses.COMPANY
    );
  }

  async createExternalDBOpportunity(createdOpportunityId: string | string[]) {
    return this.externalDatabasesService.createExternalDBOpportunity(
      createdOpportunityId
    );
  }

  async updateExternalDBOpportunity(updatedOpportunityId: string | string[]) {
    return this.externalDatabasesService.updateExternalDBOpportunity(
      updatedOpportunityId
    );
  }
}
