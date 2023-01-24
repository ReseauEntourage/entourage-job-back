import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';
import { PayloadUser } from 'src/auth/auth.types';
import { Public, UserPayload } from 'src/auth/guards';
import { PleziTrackingData } from 'src/external-services/plezi/plezi.types';
import {
  LinkedUser,
  LinkedUserGuard,
  Roles,
  RolesGuard,
} from 'src/users/guards';
import { UserRole, UserRoles } from 'src/users/users.types';
import { getCandidateIdFromCoachOrCandidate } from 'src/users/users.utils';
import { isValidPhone } from 'src/utils/misc';
import { AdminZone, FilterParams } from 'src/utils/types';
import { CreateExternalOpportunityRestrictedDto } from './dto/create-external-opportunity-restricted.dto';
import { CreateExternalOpportunityDto } from './dto/create-external-opportunity.dto';
import { CreateExternalOpportunityPipe } from './dto/create-external-opportunity.pipe';
import { CreateOpportunityUserEventDto } from './dto/create-opportunity-user-event.dto';
import { CreateOpportunityUserEventPipe } from './dto/create-opportunity-user-event.pipe';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { CreateOpportunityPipe } from './dto/create-opportunity.pipe';
import { UpdateExternalOpportunityRestrictedDto } from './dto/update-external-opportunity-restricted.dto';
import { UpdateExternalOpportunityDto } from './dto/update-external-opportunity.dto';
import { UpdateExternalOpportunityPipe } from './dto/update-external-opportunity.pipe';
import { UpdateOpportunityUserDto } from './dto/update-opportunity-user.dto';
import { UpdateOpportunityUserPipe } from './dto/update-opportunity-user.pipe';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { UpdateOpportunityPipe } from './dto/update-opportunity.pipe';
import { Opportunity } from './models';
import { OpportunitiesService } from './opportunities.service';
import {
  OfferAdminTab,
  OfferCandidateTab,
  OfferFilterKey,
  OfferStatuses,
  OpportunityRestricted,
} from './opportunities.types';
import { OpportunityUsersService } from './opportunity-users.service';

// TODO change to /opportunitites
@Controller('opportunity')
export class OpportunitiesController {
  constructor(
    private readonly opportunitiesService: OpportunitiesService,
    private readonly opportunityUsersService: OpportunityUsersService
  ) {}

  @Public()
  @Post()
  async create(
    @UserPayload('role') role: UserRole,
    @Body(new CreateOpportunityPipe())
    createOpportunityDto: CreateOpportunityDto,
    @UserPayload('id') userId?: string
  ) {
    if (userId && !uuidValidate(userId)) {
      throw new BadRequestException();
    }
    const isLoggedAsAdmin = role === UserRoles.ADMIN;

    const {
      isAdmin,
      locations,
      shouldSendNotifications,
      isCopy,
      candidatesIds,
      visit,
      visitor,
      urlParams,
      ...restBody
    } = createOpportunityDto;

    const pleziTrackingData: PleziTrackingData = { visit, visitor, urlParams };

    if (isAdmin && !isLoggedAsAdmin) {
      throw new ForbiddenException();
    }

    if (
      !isCopy &&
      createOpportunityDto.recruiterPhone &&
      !isValidPhone(createOpportunityDto.recruiterPhone)
    ) {
      throw new BadRequestException();
    }

    let createdOpportunities: Partial<Opportunity>[] | Partial<Opportunity>;

    if (locations && Array.isArray(locations) && locations.length > 1) {
      createdOpportunities = await Promise.all(
        locations.map(async ({ department, address }) => {
          const createdOpportunity = await this.opportunitiesService.create(
            { ...restBody, department, address, isValidated: isAdmin },
            userId
          );

          const candidates =
            await this.opportunitiesService.associateCandidatesToOpportunity(
              createdOpportunity,
              candidatesIds
            );

          const finalOpportunity = await this.opportunitiesService.findOne(
            createdOpportunity.id
          );

          await this.opportunitiesService.sendMailsAfterCreation(
            finalOpportunity.toJSON(),
            candidates,
            isAdmin,
            shouldSendNotifications,
            pleziTrackingData
          );

          await this.opportunitiesService.createExternalDBOpportunity(
            finalOpportunity.id
          );

          return finalOpportunity.toJSON();
        })
      );

      await this.opportunitiesService.createExternalDBOpportunity(
        createdOpportunities.map(({ id }) => {
          return id;
        })
      );
      return createdOpportunities;
    }

    let opportunityToCreate = restBody;
    if (locations) {
      const locationsToTransform = Array.isArray(locations)
        ? locations[0]
        : locations;
      opportunityToCreate = {
        ...opportunityToCreate,
        ...locationsToTransform,
      };
    }

    const createdOpportunity = await this.opportunitiesService.create(
      { ...opportunityToCreate, isValidated: isAdmin },
      userId
    );

    const candidates =
      await this.opportunitiesService.associateCandidatesToOpportunity(
        createdOpportunity,
        candidatesIds
      );

    const finalOpportunity = await this.opportunitiesService.findOne(
      createdOpportunity.id
    );

    await this.opportunitiesService.sendMailsAfterCreation(
      finalOpportunity.toJSON(),
      candidates,
      isAdmin,
      shouldSendNotifications,
      pleziTrackingData
    );

    await this.opportunitiesService.createExternalDBOpportunity(
      finalOpportunity.id
    );

    return createdOpportunity.toJSON();
  }

  @LinkedUser('body.candidateId')
  @UseGuards(LinkedUserGuard)
  @Post('external')
  async createExternal(
    @UserPayload('role') role: UserRole,
    // Do not instantiate CreateExternalOpportunityPipe so that Request can be injected
    @Body(CreateExternalOpportunityPipe)
    createExternalOpportunityDto:
      | CreateExternalOpportunityDto
      | CreateExternalOpportunityRestrictedDto,
    @UserPayload('id') userId?: string
  ) {
    if (userId && !uuidValidate(userId)) {
      throw new BadRequestException();
    }

    const isAdmin = role === UserRoles.ADMIN;

    const { candidateId, coachNotification, ...restParams } =
      createExternalOpportunityDto;

    const candidate = await this.opportunitiesService.findOneCandidate(
      candidateId
    );

    if (!candidate) {
      throw new NotFoundException();
    }

    const createdOpportunity = await this.opportunitiesService.create(
      {
        ...restParams,
        isExternal: true,
        isPublic: false,
        isArchived: false,
        isValidated: true,
      },
      userId
    );

    await this.opportunityUsersService.createOrRestore({
      OpportunityId: createdOpportunity.id,
      UserId: candidateId,
      status:
        createExternalOpportunityDto.status &&
        createExternalOpportunityDto.status > OfferStatuses.TO_PROCESS.value
          ? createExternalOpportunityDto.status
          : OfferStatuses.CONTACTED.value,
      seen: true,
    });

    const finalOpportunity = await this.opportunitiesService.findOneAsCandidate(
      createdOpportunity.id,
      candidateId
    );
    await this.opportunitiesService.sendMailAfterExternalCreation(
      finalOpportunity,
      isAdmin,
      coachNotification,
      candidateId
    );
    await this.opportunitiesService.createExternalDBOpportunity(
      finalOpportunity.id
    );

    return finalOpportunity;
  }

  @LinkedUser('body.candidateId')
  @UseGuards(LinkedUserGuard)
  @Post('join')
  async createOpportunityUser(
    @Body('opportunityId', new ParseUUIDPipe()) opportunityId: string,
    @Body('candidateId', new ParseUUIDPipe()) candidateId: string,
    @UserPayload('role') role: UserRole
  ) {
    const opportunity = await this.opportunitiesService.findOne(opportunityId);

    if (!opportunity) {
      throw new NotFoundException();
    }

    if (
      (!opportunity.isPublic || !opportunity.isValidated) &&
      role !== UserRoles.ADMIN
    ) {
      throw new ForbiddenException();
    }

    const opportunityUser =
      await this.opportunityUsersService.findOneByCandidateIdAndOpportunityId(
        candidateId,
        opportunityId
      );

    const createdOrUpdatedOpportunityUser = opportunityUser
      ? await this.opportunityUsersService.updateByCandidateIdAndOpportunityId(
          candidateId,
          opportunityId,
          {
            seen: true,
          }
        )
      : await this.opportunityUsersService.createOrRestore({
          OpportunityId: opportunityId,
          UserId: candidateId,
          seen: true,
        });

    await this.opportunitiesService.updateExternalDBOpportunity(
      createdOrUpdatedOpportunityUser.OpportunityId
    );

    return createdOrUpdatedOpportunityUser.toJSON();
  }

  @LinkedUser('body.candidateId')
  @UseGuards(LinkedUserGuard)
  @Post('event')
  async createOpportunityUserEvent(
    @Body(new CreateOpportunityUserEventPipe())
    createOpportunityUserEventDto: CreateOpportunityUserEventDto,
    @UserPayload('role') role: UserRole
  ) {
    const { opportunityId, candidateId, ...restCreateOpportunityUserEventDto } =
      createOpportunityUserEventDto;
    const opportunity = await this.opportunitiesService.findOne(opportunityId);

    if (!opportunity) {
      throw new NotFoundException();
    }

    const opportunityUser =
      await this.opportunityUsersService.findOneByCandidateIdAndOpportunityId(
        candidateId,
        opportunityId
      );

    if (!opportunityUser) {
      throw new NotFoundException();
    }

    if (!opportunity.isValidated && role !== UserRoles.ADMIN) {
      throw new ForbiddenException();
    }

    return await this.opportunityUsersService.createOpportunityUserEvent(
      candidateId,
      opportunityId,
      restCreateOpportunityUserEventDto
    );
  }

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin')
  async findAll(
    @Query()
    query: {
      type: OfferAdminTab;
      search: string;
    } & FilterParams<OfferFilterKey>
  ) {
    return this.opportunitiesService.findAll(query);
  }

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Get('/candidate/private/:candidateId')
  async findAllUserOpportunitiesAsAdmin(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Query()
    query: {
      search: string;
    } & FilterParams<OfferFilterKey>
  ) {
    const opportunityUsers =
      await this.opportunityUsersService.findAllByCandidateId(candidateId);

    if (!opportunityUsers) {
      throw new NotFoundException();
    }

    if (opportunityUsers.length === 0) {
      return [] as Opportunity[];
    }

    const opportunitiesIds = opportunityUsers.map((opportunityUser) => {
      return opportunityUser.OpportunityId;
    });

    return this.opportunitiesService.findAllUserOpportunitiesAsAdmin(
      candidateId,
      opportunitiesIds,
      query
    );
  }

  @Roles(UserRoles.CANDIDATE, UserRoles.COACH)
  @UseGuards(RolesGuard)
  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Get('/candidate/tabCount/:candidateId')
  async countOffersByStatus(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string
  ) {
    const opportunityUsers =
      await this.opportunityUsersService.findAllByCandidateId(candidateId);

    if (!opportunityUsers) {
      throw new NotFoundException();
    }

    return await this.opportunityUsersService.countOffersByStatus(candidateId);
  }

  @Roles(UserRoles.CANDIDATE, UserRoles.COACH)
  @UseGuards(RolesGuard)
  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Get('/candidate/all/:candidateId')
  async findAllAsCandidate(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Query()
    query: {
      type: OfferCandidateTab;
      search: string;
      offset: number;
      limit: number;
    } & FilterParams<OfferFilterKey>
  ) {
    const opportunityUsers =
      await this.opportunityUsersService.findAllByCandidateId(candidateId);

    if (!opportunityUsers) {
      throw new NotFoundException();
    }

    const { type, status } = query;
    if (type !== 'public' && !status) {
      throw new BadRequestException('status expected');
    }

    const opportunities = await this.opportunitiesService.findAllAsCandidate(
      candidateId,
      query
    );

    return {
      offers: opportunities,
    };
  }

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin/count')
  async countPending(@UserPayload('zone') zone: AdminZone) {
    return this.opportunitiesService.countPending(zone);
  }

  @Roles(UserRoles.CANDIDATE, UserRoles.COACH)
  @UseGuards(RolesGuard)
  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Get('candidate/count/:candidateId')
  async countUnseen(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string
  ) {
    return this.opportunitiesService.countUnseen(candidateId);
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserPayload('role') role: UserRole,
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @UserPayload() user: PayloadUser
  ) {
    let opportunity: Opportunity | OpportunityRestricted;
    if (role === UserRoles.ADMIN) {
      opportunity = await this.opportunitiesService.findOne(id);
    } else {
      opportunity = await this.opportunitiesService.findOneAsCandidate(
        id,
        getCandidateIdFromCoachOrCandidate(user)
      );
    }

    if (!opportunity) {
      throw new NotFoundException();
    }

    return opportunity;
  }

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Put('bulk')
  async updateAll(
    // Do not instantiate UpdateOpportunityPipe so that Request can be injected
    @Body('attributes', UpdateOpportunityPipe)
    updateOpportunityDto: UpdateOpportunityDto,
    @Body('ids') opportunitiesIds: string[]
  ) {
    const {
      shouldSendNotifications,
      candidatesIds,
      isAdmin,
      isCopy,
      locations,
      ...restOpportunity
    } = updateOpportunityDto;

    const updatedOpportunities = await this.opportunitiesService.updateAll(
      restOpportunity,
      opportunitiesIds
    );

    await this.opportunitiesService.updateExternalDBOpportunity(
      updatedOpportunities.updatedIds
    );

    return updatedOpportunities;
  }

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Put('external/:id/:candidateId')
  async updateExternal(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    // Do not instantiate UpdateExternalOpportunityPipe so that Request can be injected
    @Body(UpdateExternalOpportunityPipe)
    updateExternalOpportunityDto:
      | UpdateExternalOpportunityDto
      | UpdateExternalOpportunityRestrictedDto
  ) {
    const opportunity = await this.opportunitiesService.findOneAsCandidate(
      id,
      candidateId
    );

    if (!opportunity || !opportunity.isExternal) {
      throw new NotFoundException();
    }

    await this.opportunitiesService.update(id, updateExternalOpportunityDto);

    const updatedOpportunity =
      await this.opportunitiesService.findOneAsCandidate(id, candidateId);

    await this.opportunitiesService.updateExternalDBOpportunity(
      updatedOpportunity.id
    );

    return updatedOpportunity;
  }

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Put('join/:opportunityId/:candidateId')
  async updateOpportunityUser(
    @Param('opportunityId', new ParseUUIDPipe()) opportunityId: string,
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @UserPayload('role') role: UserRole,
    @Body(new UpdateOpportunityUserPipe())
    updateOpportunityUserDto: UpdateOpportunityUserDto
  ) {
    const opportunity = await this.opportunitiesService.findOne(opportunityId);

    if (!opportunity) {
      throw new NotFoundException();
    }

    const opportunityUser =
      await this.opportunityUsersService.findOneByCandidateIdAndOpportunityId(
        candidateId,
        opportunityId
      );

    if (!opportunityUser) {
      throw new NotFoundException();
    }

    if (!opportunity.isValidated && role !== UserRoles.ADMIN) {
      throw new ForbiddenException();
    }

    const updatedOpportunityUser =
      await this.opportunityUsersService.updateByCandidateIdAndOpportunityId(
        candidateId,
        opportunityId,
        updateOpportunityUserDto
      );

    await this.opportunitiesService.updateExternalDBOpportunity(
      updatedOpportunityUser.OpportunityId
    );

    await this.opportunitiesService.sendOnStatusUpdatedMails(
      updatedOpportunityUser,
      opportunityUser
    );

    return updatedOpportunityUser;
  }

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new UpdateOpportunityPipe())
    updateOpportunityDto: UpdateOpportunityDto
  ) {
    const { shouldSendNotifications, candidatesIds, ...restOpportunity } =
      updateOpportunityDto;

    const opportunity = await this.opportunitiesService.findOne(id);

    if (!opportunity) {
      throw new NotFoundException();
    }

    const shouldVerifyPhoneForRetroCompatibility =
      opportunity.isValidated === restOpportunity.isValidated &&
      opportunity.isArchived === restOpportunity.isArchived;

    if (
      shouldVerifyPhoneForRetroCompatibility &&
      restOpportunity.recruiterPhone &&
      !isValidPhone(restOpportunity.recruiterPhone)
    ) {
      throw new BadRequestException();
    }

    await this.opportunitiesService.update(id, restOpportunity);

    const updatedOpportunity = await this.opportunitiesService.findOne(id);

    const candidatesToSendMailTo =
      await this.opportunitiesService.updateAssociatedCandidatesToOpportunity(
        updatedOpportunity,
        opportunity,
        candidatesIds
      );

    const finalOpportunity = await this.opportunitiesService.findOne(id);

    await this.opportunitiesService.sendMailsAfterUpdate(
      finalOpportunity.toJSON(),
      opportunity.toJSON(),
      candidatesToSendMailTo
    );

    await this.opportunitiesService.updateExternalDBOpportunity(
      updatedOpportunity.id
    );

    return finalOpportunity.toJSON();
  }

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Post('refreshSalesforce')
  async refreshSalesforceOpportunities() {
    const opportunities = await this.opportunitiesService.findAllIds();
    return this.opportunitiesService.refreshSalesforceOpportunities(
      opportunities.map(({ id }) => {
        return id;
      })
    );
  }

  @Roles(UserRoles.CANDIDATE, UserRoles.COACH)
  @UseGuards(RolesGuard)
  @LinkedUser('body.candidateId')
  @UseGuards(LinkedUserGuard)
  @Post('contactEmployer')
  async contactEmployer(
    @Body('type') type: string,
    @Body('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Body('opportunityId', new ParseUUIDPipe()) opportunityId: string,
    @Body('description') description: string
  ) {
    if (!type) {
      throw new BadRequestException('type of contact is missing');
    }

    const opportunity = await this.opportunitiesService.findOne(opportunityId);

    if (!opportunity) {
      throw new NotFoundException();
    }

    if (!opportunity.recruiterMail) {
      throw new BadRequestException('no recruiter email');
    }

    const opportunityUser =
      this.opportunityUsersService.findOneByCandidateIdAndOpportunityId(
        candidateId,
        opportunityId
      );

    if (!opportunityUser) {
      throw new ForbiddenException();
    }

    this.opportunitiesService.sendContactEmployer(
      type,
      candidateId,
      opportunity.recruiterMail,
      description
    );
    if (type === 'contact') {
      this.opportunityUsersService.updateByCandidateIdAndOpportunityId(
        candidateId,
        opportunityId,
        {
          status: 0,
        }
      );
    }
  }
}
