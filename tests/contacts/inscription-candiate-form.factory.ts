// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import phone from 'phone';
import { HeardAbout, CandidateYesNoNSPP } from 'src/contacts/contacts.types';
import { InscriptionCandidateFormDto } from 'src/contacts/dto/inscription-candidate-form.dto';
import { Factory } from 'src/utils/types';

@Injectable()
export class InscriptionCandidateFormFactory
  implements Factory<InscriptionCandidateFormDto>
{
  generateInscriptionCandidateFormAnswers(
    props: Partial<InscriptionCandidateFormDto>
  ): InscriptionCandidateFormDto {
    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    const fakeData = {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      phone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      email: faker.internet.email(),
      location: '93',
      workingRight: faker.random.objectElement(CandidateYesNoNSPP),
      heardAbout: faker.random.objectElement(HeardAbout),
      birthdate: faker.date.past(40),
      infoCo: '',
    };
    return {
      ...fakeData,
      ...props,
    };
  }

  public async create(
    props: Partial<InscriptionCandidateFormDto> = {}
  ): Promise<InscriptionCandidateFormDto> {
    return this.generateInscriptionCandidateFormAnswers(props);
  }
}
