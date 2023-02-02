// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
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
    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    const fakeData = {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      phone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      email: faker.internet.email(),
      company: faker.company.companyName(2),
      position: faker.word.noun(2),
      zone: faker.random.arrayElement(
        AdminZoneFilters.map(({ value }) => value)
      ),
      approach: faker.random.objectElement(CompanyApproaches),
      heardAbout: faker.random.objectElement(HeardAbout),
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
