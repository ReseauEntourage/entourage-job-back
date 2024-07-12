// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import phone from 'phone';
import { BusinessLineFilters } from 'src/common/business-lines/business-lines.types';
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
    const fakePhoneNumber = faker.phone.number('+336 ## ## ## ##');

    const fakeData = {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      phone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      email: faker.internet.email(),
      birthDate: faker.date.past(),
      structure: faker.company.name(),
      postalCode: faker.address.zipCode('#####'),
      city: faker.address.city(),
      address: faker.address.city(),
      workerFirstName: faker.name.firstName(),
      workerLastName: faker.name.lastName(),
      workerPhone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      workerEmail: faker.internet.email(),
      workerPosition: faker.name.jobTitle(),
      helpWith: [faker.helpers.objectValue(CandidateHelpWith)],
      gender: faker.helpers.objectValue(CandidateGenders),
      professionalSituation: faker.helpers.objectValue(
        CandidateProfessionalSituations
      ),
      resources: faker.helpers.objectValue(CandidateResources),
      businessLines: faker.helpers
        .arrayElements(BusinessLineFilters)
        .map(({ value }) => value),
      handicapped: faker.helpers.objectValue(CandidateYesNo),
      registeredUnemploymentOffice: faker.helpers.objectValue(CandidateYesNo),
      administrativeSituation: faker.helpers.objectValue(
        CandidateAdministrativeSituations
      ),
      workingRight: faker.helpers.objectValue(CandidateYesNo),
      accommodation: faker.helpers.objectValue(CandidateAccommodations),
      domiciliation: faker.helpers.objectValue(CandidateYesNo),
      socialSecurity: faker.helpers.objectValue(CandidateYesNo),
      bankAccount: faker.helpers.objectValue(CandidateYesNo),
      diagnostic: faker.lorem.paragraphs(3, '\n'),
      description: faker.lorem.paragraphs(3, '\n'),
      heardAbout: faker.helpers.objectValue(HeardAbout),
      contactWithCoach: faker.datatype.boolean(),
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
