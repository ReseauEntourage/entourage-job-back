// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import phone from 'phone';
import {
  CandidateAccommodations,
  CandidateAdministrativeSituations,
  CandidateNationalities,
  CandidateYesNo,
} from 'src/contacts/contacts.types';
import { ContactCandidateFormDto } from 'src/contacts/dto/contact-candidate-form.dto';
import { Factory } from 'src/utils/types';

@Injectable()
export class ContactCandidateFormFactory
  implements Factory<ContactCandidateFormDto>
{
  generateContactCandidateFormAnswers(
    props: Partial<ContactCandidateFormDto>
  ): ContactCandidateFormDto {
    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    const fakeData = {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      phone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      email: faker.internet.email(),
      postalCode: faker.address.zipCode(),
      birthDate: faker.date.past(),
      structure: faker.company.companyName(2),
      structureAddress: faker.address.streetAddress(),
      workerFirstName: faker.name.firstName(),
      workerLastName: faker.name.lastName(),
      workerPhone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      workerEmail: faker.internet.email(),
      nationality: faker.random.objectElement(CandidateNationalities),
      administrativeSituation: faker.random.objectElement(
        CandidateAdministrativeSituations
      ),
      workingRight: faker.random.objectElement(CandidateYesNo),
      accommodation: faker.random.objectElement(CandidateAccommodations),
      domiciliation: faker.random.objectElement(CandidateYesNo),
      socialSecurity: faker.random.objectElement(CandidateYesNo),
      bankAccount: faker.random.objectElement(CandidateYesNo),
      diagnostic: faker.lorem.paragraphs(3, '\n'),
      comment: faker.lorem.paragraphs(3, '\n'),
      cgu: true,
    };

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<ContactCandidateFormDto> = {}
  ): Promise<ContactCandidateFormDto> {
    return this.generateContactCandidateFormAnswers(props);
  }
}
