// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import phone from 'phone';
import { ContactCompanyFormDto, ContactUsFormDto } from 'src/mails/dto';
import {
  CompanyApproachFilters,
  HeardAbout,
  HeardAboutFilters,
} from 'src/mails/mails.types';
import { AdminZoneFilters, AdminZones, Factory } from 'src/utils/types';
import { Departments } from 'src/common/locations/locations.types';

@Injectable()
export class ContactCompanyFormFactory
  implements Factory<ContactCompanyFormDto>
{
  generateContactCompanyFormAnswers(
    props: Partial<ContactCompanyFormDto>
  ): ContactCompanyFormDto {
    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    const fakeData = {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      phone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      email: faker.internet.email(),
      company: faker.company.companyName(2),
      regions: faker.random.arrayElements(
        AdminZoneFilters.map(({ value }) => value)
      ),
      approach: faker.random.arrayElements(
        CompanyApproachFilters.map(({ value }) => value)
      ),
      heardAbout: faker.random.arrayElement(HeardAboutFilters).value,
    };

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<ContactCompanyFormDto> = {}
  ): Promise<ContactCompanyFormDto> {
    return this.generateContactCompanyFormAnswers(props);
  }
}
