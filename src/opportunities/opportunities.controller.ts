import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';
import { Public, UserPayload } from 'src/auth/guards';
import { UserRole, UserRoles } from 'src/users/users.types';
import { isValidPhone } from 'src/utils/misc';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { Opportunity } from './models';
import { OpportunitiesService } from './opportunities.service';
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
    @Body() createOpportunityDto: CreateOpportunityDto,
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
      throw new UnauthorizedException();
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
          await this.opportunitiesService.sendMailsAfterCreation(
            createdOpportunity.toJSON(),
            candidatesId,
            isAdmin,
            shouldSendNotifications
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
    await this.opportunitiesService.sendMailsAfterCreation(
      createdOpportunity.toJSON(),
      candidatesId,
      isAdmin,
      shouldSendNotifications
    );

    await this.opportunitiesService.createExternalDBOpportunity(
      createdOpportunity.id
    );

    return createdOpportunity.toJSON();
  }

  /*
    @Get()
    findAll() {
     return this.opportunitiesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
     return this.opportunitiesService.findOne(id);
    }

    @Patch(':id')
    update(
     @Param('id') id: string,
     @Body() updateOpportunityDto: UpdateOpportunityDto
    ) {
     return this.opportunitiesService.update(+id, updateOpportunityDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
     return this.opportunitiesService.remove(+id);
    }
 */
}
