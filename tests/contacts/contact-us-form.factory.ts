// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import phone from 'phone';
import { HeardAboutFilters } from 'src/contacts/contacts.types';
import { ContactUsFormDto } from 'src/contacts/dto';
import { Factory } from 'src/utils/types';

@Injectable()
export class ContactUsFormFactory implements Factory<ContactUsFormDto> {
  generateContactUsFormAnswers(
    props: Partial<ContactUsFormDto>
  ): ContactUsFormDto {
    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    const fakeData = {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      phone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      email: faker.internet.email(),
      structure: faker.company.companyName(2),
      message: faker.lorem.paragraphs(3, '\n'),
      heardAbout: faker.random.arrayElement(HeardAboutFilters).value,
      cgu: true,
    };
    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<ContactUsFormDto> = {}
  ): Promise<ContactUsFormDto> {
    return this.generateContactUsFormAnswers(props);
  }
}
