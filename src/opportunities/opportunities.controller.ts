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
import {
  LinkedUser,
  LinkedUserGuard,
  UserPermissions,
  UserPermissionsGuard,
} from 'src/users/guards';
import { Permissions, UserRole, UserRoles } from 'src/users/users.types';
import { getCandidateIdFromCoachOrCandidate } from 'src/users/users.utils';
import { isValidPhone } from 'src/utils/misc';
import { AdminZone, FilterParams } from 'src/utils/types';
import {
  CreateExternalOpportunityDto,
  CreateExternalOpportunityPipe,
  CreateExternalOpportunityRestrictedDto,
  CreateOpportunityDto,
  CreateOpportunityPipe,
  CreateOpportunityUserEventDto,
  CreateOpportunityUserEventPipe,
  UpdateExternalOpportunityDto,
  UpdateExternalOpportunityPipe,
  UpdateExternalOpportunityRestrictedDto,
  UpdateOpportunityDto,
  UpdateOpportunityPipe,
  UpdateOpportunityUserDto,
  UpdateOpportunityUserEventDto,
  UpdateOpportunityUserEventPipe,
  UpdateOpportunityUserPipe,
} from './dto';
import { Opportunity } from './models';
import { OpportunitiesService } from './opportunities.service';
import {
  EventTypes,
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
      ...restBody
    } = createOpportunityDto;

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
            shouldSendNotifications
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
      shouldSendNotifications
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

    const opportunityUser =
      await this.opportunityUsersService.findOneByCandidateIdAndOpportunityId(
        candidateId,
        opportunityId
      );

    if (
      ((!opportunity.isPublic && !opportunityUser) ||
        !opportunity.isValidated) &&
      role !== UserRoles.ADMIN
    ) {
      throw new ForbiddenException();
    }

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

    const createdOpportunityUserEvent =
      await this.opportunityUsersService.createOpportunityUserEvent(
        candidateId,
        opportunityId,
        restCreateOpportunityUserEventDto
      );

    if (
      createdOpportunityUserEvent.type === EventTypes.INTERVIEW ||
      createdOpportunityUserEvent.type === EventTypes.HIRING
    ) {
      await this.opportunityUsersService.createOrUpdateExternalDBEvent(
        createdOpportunityUserEvent.id
      );
    }

    return createdOpportunityUserEvent;
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
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

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
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

  @UserPermissions(Permissions.CANDIDATE, Permissions.COACH)
  @UseGuards(UserPermissionsGuard)
  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Get('/candidate/tabCount/:candidateId')
  async candidateCountOffersByStatus(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string
  ) {
    const opportunityUsers =
      await this.opportunityUsersService.findAllByCandidateId(candidateId);

    if (!opportunityUsers) {
      throw new NotFoundException();
    }

    return this.opportunityUsersService.candidateCountOffersByStatus(candidateId);
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Get('/admin/tabCount')
  async adminCountOffersByType(
    @Query()
    query: {
      type: OfferAdminTab;
      search: string;
    } & FilterParams<OfferFilterKey>
  ) {
    console.log(query);
    const { type, search, businessLines, department, contracts } = query
    console.log(type);
    return this.opportunitiesService.adminCountOfferByType(type, search,businessLines, department, contracts);
  }

  @UserPermissions(Permissions.CANDIDATE, Permissions.COACH)
  @UseGuards(UserPermissionsGuard)
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
    const { type, status } = query;
    if (type !== 'public' && !status) {
      throw new BadRequestException('status expected');
    }

    const opportunities = await this.opportunitiesService.findAllAsCandidate(
      candidateId,
      query
    );

    if (!opportunities) {
      throw new NotFoundException();
    }

    return {
      offers: opportunities,
    };
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Get('admin/count')
  async countPending(@UserPayload('zone') zone: AdminZone) {
    return this.opportunitiesService.countPending(zone);
  }

  @UserPermissions(Permissions.CANDIDATE, Permissions.COACH)
  @UseGuards(UserPermissionsGuard)
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
      const candidateId = getCandidateIdFromCoachOrCandidate(user);

      opportunity = await this.opportunitiesService.findOneAsCandidate(
        id,
        candidateId
      );
    }

    if (!opportunity) {
      throw new NotFoundException();
    }

    return opportunity;
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
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

  @Put('event/:id')
  async updateOpportunityUserEvent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserPayload('role') role: UserRole,
    @UserPayload() user: PayloadUser,
    @Body(new UpdateOpportunityUserEventPipe())
    updateOpportunityUserEventDto: UpdateOpportunityUserEventDto
  ) {
    const opportunityUserEvent =
      await this.opportunityUsersService.findOneOpportunityUserEvent(id);

    if (!opportunityUserEvent) {
      throw new NotFoundException();
    }

    const opportunityUser = await this.opportunityUsersService.findOne(
      opportunityUserEvent.OpportunityUserId
    );

    if (!opportunityUser) {
      throw new NotFoundException();
    }

    const candidateId = getCandidateIdFromCoachOrCandidate(user);

    if (
      Array.isArray(candidateId)
        ? !candidateId.includes(opportunityUser.UserId)
        : opportunityUser.UserId !== candidateId && role !== UserRoles.ADMIN
    ) {
      throw new ForbiddenException();
    }

    const opportunity = await this.opportunitiesService.findOne(
      opportunityUser.OpportunityId
    );

    if (!opportunity) {
      throw new NotFoundException();
    }

    if (!opportunity.isValidated && role !== UserRoles.ADMIN) {
      throw new ForbiddenException();
    }

    const updatedOpportunityUserEvent =
      await this.opportunityUsersService.updateOpportunityUserEvent(
        id,
        updateOpportunityUserEventDto
      );

    if (
      updatedOpportunityUserEvent.type === EventTypes.INTERVIEW ||
      updatedOpportunityUserEvent.type === EventTypes.HIRING
    ) {
      await this.opportunityUsersService.createOrUpdateExternalDBEvent(
        updatedOpportunityUserEvent.id
      );
    }

    return updatedOpportunityUserEvent;
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
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

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Post('refreshSalesforce/opportunities')
  async refreshSalesforceOpportunities() {
    const opportunities = await this.opportunitiesService.findAllIds();
    return this.opportunitiesService.refreshSalesforceOpportunities(
      opportunities.map(({ id }) => {
        return id;
      })
    );
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Post('refreshSalesforce/events')
  async refreshSalesforceEvents() {
    const events =
      await this.opportunityUsersService.findAllOpportunityUserEventIds();
    return this.opportunityUsersService.refreshSalesforceEvents(
      events.map(({ id }) => {
        return id;
      })
    );
  }

  @UserPermissions(Permissions.CANDIDATE, Permissions.COACH)
  @UseGuards(UserPermissionsGuard)
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

    const opportunityUser =
      await this.opportunityUsersService.findOneByCandidateIdAndOpportunityId(
        candidateId,
        opportunityId
      );

    if (
      !opportunityUser ||
      !opportunity.isValidated ||
      opportunity.isExternal
    ) {
      throw new ForbiddenException();
    }

    if (!opportunity.recruiterMail) {
      throw new BadRequestException('no recruiter email');
    }

    await this.opportunitiesService.sendContactEmployer(
      type,
      candidateId,
      opportunity,
      description
    );

    if (type === 'contact') {
      await this.opportunityUsersService.updateByCandidateIdAndOpportunityId(
        candidateId,
        opportunityId,
        {
          status: 0,
        }
      );
    }
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Post('sendReminderArchive')
  async postSendReminderArchive(@Body('ids') opportunitiesIds: string[]) {
    let count = 0;
    let failed = 0;
    await Promise.all(
      opportunitiesIds.map(async (id) => {
        const opportunity = await this.opportunitiesService.findOne(id);
        if (!opportunity || !opportunity.recruiterMail) {
          failed += 1;
          return;
        }
        await this.opportunitiesService.sendArchiveOfferReminder(opportunity);
        count += 1;
      })
    );
    return 'Emails envoyés: ' + count + ', emails non envoyés: ' + failed;
  }
}
