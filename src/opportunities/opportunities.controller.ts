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
import { UserCandidat } from '../users/models';
import { getCandidateIdFromCoachOrCandidate } from '../users/users.utils';
import { Public, UserPayload } from 'src/auth/guards';
import { DepartmentFilters } from 'src/locations/locations.types';
import {
  LinkedUser,
  LinkedUserGuard,
  Roles,
  RolesGuard,
} from 'src/users/guards';
import { UserRole, UserRoles } from 'src/users/users.types';
import { isValidPhone } from 'src/utils/misc';
import { AdminZone, FilterParams } from 'src/utils/types';
import { CreateExternalOpportunityDto } from './dto/create-external-opportunity.dto';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { CreateOpportunityPipe } from './dto/create-opportunity.pipe';
import { ExternalOpportunityPipe } from './dto/external-opportunity.pipe';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { UpdateOpportunityPipe } from './dto/update-opportunity.pipe';
import { Opportunity } from './models';
import { OpportunitiesService } from './opportunities.service';
import {
  OfferAdminTab,
  OfferCandidateTab,
  OfferCandidateTabs,
  OfferFilterKey,
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
            { ...restBody, department, address },
            candidatesId,
            isAdmin,
            userId
          );

          const candidates =
            await this.opportunitiesService.associateCandidatesToOpportunity(
              createdOpportunity,
              candidatesId
            );

          await this.opportunitiesService.sendMailsAfterCreation(
            createdOpportunity.toJSON(),
            candidates,
            isAdmin,
            shouldSendNotifications
          );

          await this.opportunitiesService.createExternalDBOpportunity(
            createdOpportunity.id
          );

          return createdOpportunity.toJSON();
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
      opportunityToCreate,
      candidatesId,
      isAdmin,
      userId
    );

    const candidates =
      await this.opportunitiesService.associateCandidatesToOpportunity(
        createdOpportunity,
        candidatesId
      );

    await this.opportunitiesService.sendMailsAfterCreation(
      createdOpportunity.toJSON(),
      candidates,
      isAdmin,
      shouldSendNotifications
    );

    await this.opportunitiesService.createExternalDBOpportunity(
      createdOpportunity.id
    );

    return createdOpportunity.toJSON();
  }

  @LinkedUser('body.candidateId')
  @UseGuards(LinkedUserGuard)
  @Post('external')
  async createExternal(
    @UserPayload('role') role: UserRole,
    @Body(new ExternalOpportunityPipe())
    createExternalOpportunityDto: CreateExternalOpportunityDto,
    @UserPayload('id') userId?: string
  ) {
    if (userId && !uuidValidate(userId)) {
      throw new BadRequestException();
    }
    const isAdmin = role === UserRoles.ADMIN;

    const { candidateId, ...restParams } = createExternalOpportunityDto;

    const createdOpportunity = await this.opportunitiesService.createExternal(
      restParams,
      candidateId,
      userId
    );

    if (!createdOpportunity) {
      throw new NotFoundException();
    }

    await this.opportunityUsersService.create({
      OpportunityId: createdOpportunity.id,
      UserId: candidateId,
      status:
        createExternalOpportunityDto.status &&
        createExternalOpportunityDto.status > -1
          ? createExternalOpportunityDto.status
          : 0,
    });

    await this.opportunitiesService.sendMailAfterExternalCreation(
      createdOpportunity,
      isAdmin
    );

    await this.opportunitiesService.createExternalDBOpportunity(
      createdOpportunity.id
    );

    return createdOpportunity;
  }

  // todo change to candidateId
  @LinkedUser('body.userId')
  @UseGuards(LinkedUserGuard)
  @Post('join')
  async openOpportunity(
    @Body('opportunityId', new ParseUUIDPipe()) opportunityId: string,
    @Body('userId', new ParseUUIDPipe()) candidateId: string
  ) {
    const opportunityUser =
      await this.opportunityUsersService.findOneByCandidateIdAndOpportunityId(
        candidateId,
        opportunityId
      );

    if (opportunityUser) {
      return this.opportunityUsersService.updateByCandidateIdAndOpportunityId(
        candidateId,
        opportunityId,
        {
          seen: true,
        }
      );
    } else {
      return this.opportunityUsersService.create({
        OpportunityId: opportunityId,
        UserId: candidateId,
        seen: true,
      });
    }
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

    return this.opportunitiesService.findAllUserOpportunitiesAsAdmin(
      candidateId,
      opportunityUsers.map((opportunityUser) => {
        return opportunityUser.OpportunityId;
      }),
      query
    );
  }

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

    if (opportunityUsers.length === 0) {
      return [] as Opportunity[];
    }

    const opportunityUserIds = opportunityUsers.map((opportunityUser) => {
      return opportunityUser.OpportunityId;
    });

    const opportunities = await this.opportunitiesService.findAllAsCandidate(
      candidateId,
      opportunityUsers.map((opportunityUser) => {
        return opportunityUser.OpportunityId;
      }),
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
          opportunityUserIds,
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

    const opportunity = await this.opportunitiesService.findOne(
      updateOpportunityDto.id
    );

    const shouldVerifyPhoneForRetroCompatibility =
      opportunity.isValidated === updateOpportunityDto.isValidated &&
      opportunity.isArchived === updateOpportunityDto.isArchived;

    if (
      shouldVerifyPhoneForRetroCompatibility &&
      opportunity.recruiterPhone &&
      !isValidPhone(opportunity.recruiterPhone)
    ) {
      throw new BadRequestException();
    }

    const updatedOpportunity = await this.opportunitiesService.update(
      id,
      restOpportunity
    );

    const candidates =
      await this.opportunitiesService.updateAssociatedCandidatesToOpportunity(
        updatedOpportunity,
        opportunity,
        candidatesId
      );

    await this.opportunitiesService.sendMailsAfterUpdate(
      updatedOpportunity,
      opportunity,
      candidates
    );

    await this.opportunitiesService.createExternalDBOpportunity(
      updatedOpportunity.id
    );

    return updatedOpportunity;
  }
}
