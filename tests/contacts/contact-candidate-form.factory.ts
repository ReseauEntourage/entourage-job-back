// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import phone from 'phone';
import { BusinessLineFilters } from 'src/common/businessLines/businessLines.types';
import {
  CandidateAccommodations,
  CandidateAdministrativeSituations,
  CandidateGenders,
  CandidateHelpWith,
  CandidateProfessionalSituations,
  CandidateResources,
  CandidateYesNo,
  HeardAbout,
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
      birthDate: faker.date.past(),
      structure: faker.company.companyName(2),
      postalCode: faker.address.zipCode('#####'),
      city: faker.address.city(),
      address: faker.address.city(),
      workerFirstName: faker.name.firstName(),
      workerLastName: faker.name.lastName(),
      workerPhone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      workerEmail: faker.internet.email(),
      workerPosition: faker.name.jobTitle(),
      helpWith: [faker.random.objectElement(CandidateHelpWith)],
      gender: faker.random.objectElement(CandidateGenders),
      professionalSituation: faker.random.objectElement(
        CandidateProfessionalSituations
      ),
      resources: faker.random.objectElement(CandidateResources),
      businessLines: faker.random
        .arrayElements(BusinessLineFilters)
        .map(({ value }) => value),
      handicapped: faker.random.objectElement(CandidateYesNo),
      registeredUnemploymentOffice: faker.random.objectElement(CandidateYesNo),
      administrativeSituation: faker.random.objectElement(
        CandidateAdministrativeSituations
      ),
      workingRight: faker.random.objectElement(CandidateYesNo),
      accommodation: faker.random.objectElement(CandidateAccommodations),
      domiciliation: faker.random.objectElement(CandidateYesNo),
      socialSecurity: faker.random.objectElement(CandidateYesNo),
      bankAccount: faker.random.objectElement(CandidateYesNo),
      diagnostic: faker.lorem.paragraphs(3, '\n'),
      description: faker.lorem.paragraphs(3, '\n'),
      heardAbout: faker.random.objectElement(HeardAbout),
      contactWithCoach: true,
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
