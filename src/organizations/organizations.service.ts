import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { and } from 'sequelize';
import { UsersService } from 'src/users/users.service';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { ZoneName } from 'src/utils/types/zones.types';
import { UpdateOrganizationDto } from './dto';
import { Organization } from './models';
import { OrganizationReferent } from './models/organization-referent.model';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization)
    private organizationModel: typeof Organization,
    private usersService: UsersService
  ) {}

  async create(createOrganizationDto: Partial<Organization>) {
    return this.organizationModel.create(createOrganizationDto, {
      hooks: true,
    });
  }

  async findOne(id: string) {
    return this.organizationModel.findByPk(id, {
      include: {
        model: OrganizationReferent,
        as: 'organizationReferent',
      },
    });
  }

  async findAll(
    limit: number,
    offset: number,
    search = '',
    zone?: ZoneName | ZoneName[]
  ) {
    const searchQuery = searchInColumnWhereOption('Organization.name', search);
    const whereQuery = zone ? and(searchQuery, { zone: zone }) : searchQuery;

    return this.organizationModel.findAll({
      where: whereQuery,
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
      order: [['name', 'ASC']],
      include: {
        model: OrganizationReferent,
        as: 'organizationReferent',
      },
    });
  }

  async countAssociatedUsers(organizationId: string) {
    return this.usersService.countOrganizationAssociatedUsers(organizationId);
  }

  async update(
    id: string,
    updateOrganizationDto: Pick<
      UpdateOrganizationDto,
      'name' | 'address' | 'zone'
    >
  ): Promise<Organization> {
    await this.organizationModel.update(updateOrganizationDto, {
      where: { id },
      individualHooks: true,
    });

    const updatedOrganization = await this.findOne(id);

    if (!updatedOrganization) {
      return null;
    }

    return updatedOrganization.toJSON();
  }
}
