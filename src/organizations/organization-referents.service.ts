import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UpdateOrganizationDto } from './dto';
import { OrganizationReferent } from './models/organization-referent.model';

@Injectable()
export class OrganizationReferentsService {
  constructor(
    @InjectModel(OrganizationReferent)
    private organizationReferentModel: typeof OrganizationReferent
  ) {}

  async create(createOrganizationReferentDto: Partial<OrganizationReferent>) {
    return this.organizationReferentModel.create(
      createOrganizationReferentDto,
      {
        hooks: true,
      }
    );
  }

  async findOne(id: string) {
    return this.organizationReferentModel.findByPk(id);
  }

  async update(
    id: string,
    updateOrganizationDto: Pick<
      UpdateOrganizationDto,
      | 'referentFirstName'
      | 'referentLastName'
      | 'referentPhone'
      | 'referentMail'
    >
  ): Promise<OrganizationReferent> {
    await this.organizationReferentModel.update(updateOrganizationDto, {
      where: { id },
      individualHooks: true,
    });

    const updatedOrganizationReferent = await this.findOne(id);

    if (!updatedOrganizationReferent) {
      return null;
    }

    return updatedOrganizationReferent.toJSON();
  }
}
