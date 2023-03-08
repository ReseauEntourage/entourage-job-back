// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import phone from 'phone';
import { Organization } from 'src/organizations/models';
import { OrganizationsService } from 'src/organizations/organizations.service';
import { AdminZones, Factory } from 'src/utils/types';

@Injectable()
export class OrganizationFactory implements Factory<Organization> {
  constructor(
    @InjectModel(Organization)
    private organizationModel: typeof Organization,
    private organizationsService: OrganizationsService
  ) {}

  generateOrganization(props: Partial<Organization>): Partial<Organization> {
    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    const fakeData: Partial<Organization> = {
      referentMail: faker.internet.email().toLowerCase(),
      referentFirstName: faker.name.firstName(),
      referentLastName: faker.name.lastName(),
      name: faker.company.companyName(),
      referentPhone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      address: faker.address.streetAddress(),
      zone: AdminZones.PARIS,
    };

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<Organization> = {},
    insertInDB = true
  ): Promise<Organization> {
    const organizationData = this.generateOrganization(props);
    const organizationId = faker.datatype.uuid();
    if (insertInDB) {
      await this.organizationModel.create(
        { ...organizationData, id: organizationId },
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
    const { id, ...builtOrganizationWithoutId } = builtOrganization.toJSON();
    return builtOrganizationWithoutId as Organization;
  }
}
