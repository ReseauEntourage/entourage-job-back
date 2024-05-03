// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import phone from 'phone';
import { Organization } from 'src/organizations/models';
import { OrganizationReferent } from 'src/organizations/models/organization-referent.model';
import { OrganizationsService } from 'src/organizations/organizations.service';
import { AdminZones, Factory } from 'src/utils/types';

@Injectable()
export class OrganizationFactory implements Factory<Organization> {
  constructor(
    @InjectModel(Organization)
    private organizationModel: typeof Organization,
    @InjectModel(OrganizationReferent)
    private organizationReferentModel: typeof OrganizationReferent,
    private organizationsService: OrganizationsService
  ) {}

  generateOrganization(props: Partial<Organization>): Partial<Organization> {
    const fakeData: Partial<Organization> = {
      name: faker.company.companyName(),
      address: faker.address.streetAddress(),
      zone: AdminZones.PARIS,
    };

    return {
      ...fakeData,
      ...props,
    };
  }

  generateOrganizationReferent(
    props: Partial<OrganizationReferent>
  ): Partial<OrganizationReferent> {
    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    const fakeData: Partial<OrganizationReferent> = {
      referentMail: faker.internet.email().toLowerCase(),
      referentFirstName: faker.name.firstName(),
      referentLastName: faker.name.lastName(),
      referentPhone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
    };

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<Organization> = {},
    organizationReferentProps: Partial<OrganizationReferent> = {},
    insertInDB = true
  ): Promise<Organization> {
    const organizationData = this.generateOrganization(props);
    const organizationReferentData = this.generateOrganizationReferent(
      organizationReferentProps
    );

    const organizationId = faker.datatype.uuid();
    if (insertInDB) {
      await this.organizationModel.create(
        { ...organizationData, id: organizationId },
        { hooks: true }
      );

      await this.organizationReferentModel.create(
        { ...organizationReferentData, OrganizationId: organizationId },
        { hooks: true }
      );
    }
    const dbOrganization = await this.organizationsService.findOne(
      organizationData.id || organizationId
    );
    if (dbOrganization) {
      return dbOrganization.toJSON();
    }
    const builtOrganization = await this.organizationModel.build(
      organizationData
    );

    const builtOrganizationReferent =
      await this.organizationReferentModel.build(organizationReferentData);

    const { id, ...builtOrganizationWithoutId } = builtOrganization.toJSON();
    const { id: referentId, ...builtOrganizationReferentWithoutId } =
      builtOrganizationReferent.toJSON();
    return {
      ...builtOrganizationWithoutId,
      organizationReferent: builtOrganizationReferentWithoutId,
    } as Organization;
  }
}
