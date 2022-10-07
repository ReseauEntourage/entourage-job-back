import {
  Controller,
  Post,
  Body,
  BadRequestException,
  UseGuards,
  ForbiddenException,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
  NotFoundException,
  Put,
} from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';
import { PayloadUser } from '../auth/auth.types';
import { getCandidateIdFromCoachOrCandidate } from '../users/users.utils';
import { Public, UserPayload } from 'src/auth/guards';
import { DepartmentFilters } from 'src/common/locations/locations.types';
import {
  LinkedUser,
  LinkedUserGuard,
  Roles,
  RolesGuard,
} from 'src/users/guards';
import { UserRole, UserRoles } from 'src/users/users.types';
import { isValidPhone } from 'src/utils/misc';
import { AdminZone, FilterParams } from 'src/utils/types';
import { CreateExternalOpportunityRestrictedDto } from './dto/create-external-opportunity-restricted.dto';
import { CreateExternalOpportunityDto } from './dto/create-external-opportunity.dto';
import { CreateExternalOpportunityPipe } from './dto/create-external-opportunity.pipe';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { CreateOpportunityPipe } from './dto/create-opportunity.pipe';
import { UpdateExternalOpportunityRestrictedDto } from './dto/update-external-opportunity-restricted.dto';
import { UpdateExternalOpportunityDto } from './dto/update-external-opportunity.dto';
import { UpdateExternalOpportunityPipe } from './dto/update-external-opportunity.pipe';
import { UpdateOpportunityUserDto } from './dto/update-opportunity-user.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { UpdateOpportunityPipe } from './dto/update-opportunity.pipe';
import { Opportunity } from './models';
import { OpportunitiesService } from './opportunities.service';
import {
  OfferAdminTab,
  OfferCandidateTab,
  OfferCandidateTabs,
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
      candidatesId,
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
              candidatesId
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
        candidatesId
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

    const { candidateId, ...restParams } = createExternalOpportunityDto;

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

    await this.opportunityUsersService.create({
      OpportunityId: createdOpportunity.id,
      UserId: candidateId,
      status:
        createExternalOpportunityDto.status &&
        createExternalOpportunityDto.status > OfferStatuses.TO_PROCESS.value
          ? createExternalOpportunityDto.status
          : OfferStatuses.CONTACTED.value,
    });

    const finalOpportunity = await this.opportunitiesService.findOneAsCandidate(
      createdOpportunity.id,
      candidateId
    );

    await this.opportunitiesService.sendMailAfterExternalCreation(
      finalOpportunity,
      isAdmin
    );

    await this.opportunitiesService.createExternalDBOpportunity(
      finalOpportunity.id
    );

    return finalOpportunity;
  }

  // todo change to candidateId
  @LinkedUser('body.userId')
  @UseGuards(LinkedUserGuard)
  @Post('join')
  async createOpportunityUser(
    @Body('opportunityId', new ParseUUIDPipe()) opportunityId: string,
    @Body('userId', new ParseUUIDPipe()) candidateId: string,
    @UserPayload('role') role: UserRole
  ) {
    const opportunity = await this.opportunitiesService.findOneAsCandidate(
      opportunityId,
      candidateId
    );

    if (opportunity && opportunity.opportunityUsers) {
      if (!opportunity.isValidated && role !== UserRoles.ADMIN) {
        throw new ForbiddenException();
      }

      const updatedOpportunityUser =
        await this.opportunityUsersService.updateByCandidateIdAndOpportunityId(
          candidateId,
          opportunityId,
          {
            seen: true,
          }
        );

      await this.opportunitiesService.updateExternalDBOpportunity(
        updatedOpportunityUser.OpportunityId
      );

      return updatedOpportunityUser.toJSON();
    }

    const existingOpportunity = await this.opportunitiesService.findOne(
      opportunityId
    );

    if (!existingOpportunity) {
      throw new NotFoundException();
    }

    if (
      (!existingOpportunity.isPublic || !existingOpportunity.isValidated) &&
      role !== UserRoles.ADMIN
    ) {
      throw new ForbiddenException();
    }

    const updatedOpportunityUser = await this.opportunityUsersService.create({
      OpportunityId: opportunityId,
      UserId: candidateId,
      seen: true,
    });

    await this.opportunitiesService.updateExternalDBOpportunity(
      updatedOpportunityUser.OpportunityId
    );

    return updatedOpportunityUser.toJSON();
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
  @Get('/user/private/:candidateId')
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

    const opportunityIds = opportunityUsers.map((opportunityUser) => {
      return opportunityUser.OpportunityId;
    });

    return this.opportunitiesService.findAllUserOpportunitiesAsAdmin(
      candidateId,
      opportunityIds,
      query
    );
  }

  @Roles(UserRoles.CANDIDAT, UserRoles.COACH)
  @UseGuards(RolesGuard)
  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Get('/user/all/:candidateId')
  async findAllAsCandidate(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Query()
    query: {
      type: OfferCandidateTab;
      search: string;
    } & FilterParams<OfferFilterKey>
  ) {
    const opportunityUsers =
      await this.opportunityUsersService.findAllByCandidateId(candidateId);

    if (!opportunityUsers) {
      throw new NotFoundException();
    }

    const opportunityIds = opportunityUsers.map((opportunityUser) => {
      return opportunityUser.OpportunityId;
    });

    const opportunities = await this.opportunitiesService.findAllAsCandidate(
      candidateId,
      opportunityIds,
      query
    );

    const { department, type, ...restQuery } = query;

    if (!department || type !== OfferCandidateTabs.PRIVATE) {
      return {
        offers: opportunities,
        otherOffers: [],
      };
    } else {
      const otherDepartments = DepartmentFilters.filter((dept) => {
        return !department.includes(dept.value);
      });
      const otherOpportunities =
        await this.opportunitiesService.findAllAsCandidate(
          candidateId,
          opportunityIds,
          {
            department: otherDepartments.map((dept) => {
              return dept.value;
            }),
            type: type,
            ...restQuery,
          }
        );

      return {
        offers: opportunities,
        otherOffers: otherOpportunities,
      };
    }
  }

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin/count')
  async countPending(@UserPayload('zone') zone: AdminZone) {
    return this.opportunitiesService.countPending(zone);
  }

  // TODO change to candidate/count
  @Roles(UserRoles.CANDIDAT, UserRoles.COACH)
  @UseGuards(RolesGuard)
  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Get('user/count/:candidateId')
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

  // TODO put Id in params
  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Put()
  async update(
    @Body(new UpdateOpportunityPipe())
    updateOpportunityDto: UpdateOpportunityDto
  ) {
    const { shouldSendNotifications, id, candidatesId, ...restOpportunity } =
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

    const candidates =
      await this.opportunitiesService.updateAssociatedCandidatesToOpportunity(
        updatedOpportunity,
        opportunity,
        candidatesId
      );

    const finalOpportunity = await this.opportunitiesService.findOne(id);

    await this.opportunitiesService.sendMailsAfterUpdate(
      finalOpportunity.toJSON(),
      opportunity.toJSON(),
      candidates
    );

    await this.opportunitiesService.updateExternalDBOpportunity(
      updatedOpportunity.id
    );

    return finalOpportunity.toJSON();
  }

  // TODO put Id in params
  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Put('bulk')
  async updateAll(
    @Body('attributes', UpdateOpportunityPipe)
    updateOpportunityDto: UpdateOpportunityDto,
    @Body('ids') opportunityIds: string[]
  ) {
    const {
      shouldSendNotifications,
      candidatesId,
      isAdmin,
      isCopy,
      locations,
      ...restOpportunity
    } = updateOpportunityDto;

    const updatedOpportunities = await this.opportunitiesService.updateAll(
      restOpportunity,
      opportunityIds
    );

    await this.opportunitiesService.updateExternalDBOpportunity(
      updatedOpportunities.updatedIds
    );

    return updatedOpportunities;
  }

  // TODO put Id in params
  @LinkedUser('body.candidateId')
  @UseGuards(LinkedUserGuard)
  @Put('external')
  async updateExternal(
    @Body(UpdateExternalOpportunityPipe)
    updateExternalOpportunityDto:
      | UpdateExternalOpportunityDto
      | UpdateExternalOpportunityRestrictedDto
  ) {
    const { candidateId, id, ...restOpportunity } =
      updateExternalOpportunityDto;

    if (!candidateId || !uuidValidate(candidateId)) {
      throw new BadRequestException();
    }

    const opportunity = await this.opportunitiesService.findOneAsCandidate(
      id,
      candidateId
    );

    if (!opportunity || !opportunity.isExternal) {
      throw new NotFoundException();
    }

    await this.opportunitiesService.update(id, restOpportunity);

    const updatedOpportunity =
      await this.opportunitiesService.findOneAsCandidate(id, candidateId);

    await this.opportunitiesService.updateExternalDBOpportunity(
      updatedOpportunity.id
    );

    return updatedOpportunity;
  }

  // todo change to candidateId
  @LinkedUser('body.UserId')
  @UseGuards(LinkedUserGuard)
  @Put('join')
  async updateOpportunityUser(
    @Body() updateOpportunityUserDto: UpdateOpportunityUserDto
  ) {
    const { OpportunityId, UserId, ...restOpportunityUser } =
      updateOpportunityUserDto;

    const opportunityUser =
      await this.opportunityUsersService.findOneByCandidateIdAndOpportunityId(
        UserId,
        OpportunityId
      );

    if (!opportunityUser) {
      throw new NotFoundException();
    }

    const updatedOpportunityUser =
      await this.opportunityUsersService.updateByCandidateIdAndOpportunityId(
        UserId,
        OpportunityId,
        restOpportunityUser
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
}
