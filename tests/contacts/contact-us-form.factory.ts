import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import phone from 'phone';
import { HeardAbout } from 'src/contacts/contacts.types';
import { ContactUsFormDto } from 'src/contacts/dto';
import { Factory } from 'src/utils/types';

@Injectable()
export class ContactUsFormFactory implements Factory<ContactUsFormDto> {
  generateContactUsFormAnswers(
    props: Partial<ContactUsFormDto>
  ): ContactUsFormDto {
    const fakePhoneNumber = faker.helpers.replaceSymbols('+336 ## ## ## ##');

    const fakeData: ContactUsFormDto = {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      phone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      email: faker.internet.email(),
      structure: faker.company.name(),
      message: faker.lorem.paragraphs(3, '\n'),
      heardAbout: faker.helpers.objectValue(HeardAbout),
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
