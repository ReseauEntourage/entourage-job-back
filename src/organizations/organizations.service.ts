import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UpdateOrganizationDto } from './dto';
import { Organization } from './models';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization)
    private organizationModel: typeof Organization
  ) {}

  async create(createOrganizationDto: Partial<Organization>) {
    return this.organizationModel.create(createOrganizationDto, {
      hooks: true,
    });
  }

  async findOne(id: string) {
    return this.organizationModel.findByPk(id);
  }

  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto
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
