import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Roles, UserPermissionsGuard } from '../users/guards';
import { UserRoles } from '../users/users.types';
import { isValidPhone } from '../utils/misc';
import {
  CreateOrganizationDto,
  CreateOrganizationPipe,
  UpdateOrganizationDto,
  UpdateOrganizationPipe,
} from './dto';
import { OrganizationReferentsService } from './organization-referents.service';
import { OrganizationsService } from './organizations.service';

@Controller('organization')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly organizationReferentsService: OrganizationReferentsService
  ) {}

  @Roles(UserRoles.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const organization = await this.organizationsService.findOne(id);
    if (!organization) {
      throw new NotFoundException();
    }
    return organization;
  }

  @Roles(UserRoles.ADMIN)
  @UseGuards(UserPermissionsGuard)
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

  @Roles(UserRoles.ADMIN)
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
