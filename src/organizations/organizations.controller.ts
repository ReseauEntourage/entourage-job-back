import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Put,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { Roles, RolesGuard } from '../users/guards';
import { UserRoles } from '../users/users.types';
import { isValidPhone } from '../utils/misc';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  CreateOrganizationPipe,
  UpdateOrganizationPipe,
} from './dto';
import { OrganizationsService } from './organizations.service';

@Controller('organization')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const organization = await this.organizationsService.findOne(id);
    if (!organization) {
      throw new NotFoundException();
    }
    return organization;
  }

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Post()
  async create(
    @Body(new CreateOrganizationPipe())
    createOrganizationDto: CreateOrganizationDto
  ) {
    if (
      createOrganizationDto.referentPhone &&
      !isValidPhone(createOrganizationDto.referentPhone)
    ) {
      throw new BadRequestException();
    }

    return this.organizationsService.create(createOrganizationDto);
  }
  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
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
    if (
      updateOrganizationDto.referentPhone &&
      !isValidPhone(updateOrganizationDto.referentPhone)
    ) {
      throw new BadRequestException();
    }

    return this.organizationsService.update(id, updateOrganizationDto);
  }
}
