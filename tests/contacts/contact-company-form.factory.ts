// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import phone from 'phone';
import { CompanyApproaches, HeardAbout } from 'src/contacts/contacts.types';
import { ContactCompanyFormDto } from 'src/contacts/dto';
import { AdminZoneFilters, Factory } from 'src/utils/types';

@Injectable()
export class ContactCompanyFormFactory
  implements Factory<ContactCompanyFormDto>
{
  generateContactCompanyFormAnswers(
    props: Partial<ContactCompanyFormDto>
  ): ContactCompanyFormDto {
    const fakePhoneNumber = faker.phone.number('+336 ## ## ## ##');

    const fakeData = {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      phone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      email: faker.internet.email(),
      company: faker.company.name(),
      position: faker.word.noun(2),
      zone: faker.helpers.arrayElement(
        AdminZoneFilters.map(({ value }) => value)
      ),
      approach: faker.helpers.objectValue(CompanyApproaches),
      heardAbout: faker.helpers.objectValue(HeardAbout),
      message: faker.lorem.lines(3),
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
