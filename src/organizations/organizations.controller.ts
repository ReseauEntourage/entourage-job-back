import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/auth/guards';
import { UserPermissions, UserPermissionsGuard } from 'src/users/guards';
import { Permissions } from 'src/users/users.types';
import { isValidPhone } from 'src/utils/misc';
import { AdminZone } from 'src/utils/types';
import {
  CreateOrganizationDto,
  CreateOrganizationPipe,
  UpdateOrganizationDto,
  UpdateOrganizationPipe,
} from './dto';
import { Organization } from './models';
import { OrganizationReferentsService } from './organization-referents.service';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organization')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly organizationReferentsService: OrganizationReferentsService
  ) {}

  @Public()
  @Get()
  async findAll(
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('offset', new ParseIntPipe()) offset: number,
    @Query('search') search?: string,
    @Query('zone') zone?: AdminZone | AdminZone[]
  ) {
    const organizations = await this.organizationsService.findAll(
      limit,
      offset,
      search,
      zone
    );

    return Promise.all(
      organizations.map(async (organization) => {
        const { candidatesCount, referersCount } =
          await this.organizationsService.countAssociatedUsers(organization.id);

        return {
          ...(organization.toJSON() as Organization),
          candidatesCount,
          referersCount,
        } as Organization & {
          candidatesCount: number;
          referersCount: number;
        };
      })
    );
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const organization = await this.organizationsService.findOne(id);
    if (!organization) {
      throw new NotFoundException();
    }
    return organization;
  }

  @Public()
  @Throttle(5, 60)
  @Post()
  async create(
    @Body(new CreateOrganizationPipe())
    createOrganizationDto: CreateOrganizationDto
  ) {
    const {
      referentFirstName,
      referentLastName,
      referentMail,
      referentPhone,
      ...restCreateOrganizationDto
    } = createOrganizationDto;

    if (referentPhone && !isValidPhone(referentPhone)) {
      throw new BadRequestException();
    }

    const createdOrganization = await this.organizationsService.create(
      restCreateOrganizationDto
    );

    await this.organizationReferentsService.create({
      referentFirstName,
      referentLastName,
      referentMail,
      referentPhone,
      OrganizationId: createdOrganization.id,
    });

    const updatedOrganization = await this.organizationsService.findOne(
      createdOrganization.id
    );

    return updatedOrganization.toJSON();
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new UpdateOrganizationPipe())
    updateOrganizationDto: UpdateOrganizationDto
  ) {
    const organization = await this.organizationsService.findOne(id);

    if (!organization) {
      throw new NotFoundException();
    }

    const {
      referentFirstName,
      referentLastName,
      referentMail,
      referentPhone,
      ...restUpdateOrganizationDto
    } = updateOrganizationDto;

    if (
      referentFirstName ||
      referentLastName ||
      referentMail ||
      referentPhone
    ) {
      if (referentPhone && !isValidPhone(referentPhone)) {
        throw new BadRequestException();
      }

      await this.organizationReferentsService.update(
        organization.organizationReferent.id,
        { referentFirstName, referentLastName, referentMail, referentPhone }
      );
    }

    return this.organizationsService.update(id, restUpdateOrganizationDto);
  }
}
