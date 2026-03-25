import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsValidBirthDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidBirthDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: string) {
          if (!value) return true;
          const birthDate = new Date(value);
          if (isNaN(birthDate.getTime())) return false;

          const now = new Date();

          const minBirthDate = new Date();
          minBirthDate.setFullYear(now.getFullYear() - 18);
          if (birthDate > minBirthDate) return false;

          const maxBirthDate = new Date();
          maxBirthDate.setFullYear(now.getFullYear() - 120);
          if (birthDate < maxBirthDate) return false;

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          const value = args.value as string;
          if (!value) return 'La date de naissance est invalide';

          const birthDate = new Date(value);
          if (isNaN(birthDate.getTime()))
            return 'La date de naissance est invalide';

          const now = new Date();
          const minBirthDate = new Date();
          minBirthDate.setFullYear(now.getFullYear() - 18);

          if (birthDate > minBirthDate)
            return 'Vous devez avoir plus de 18 ans pour participer au programme Entourage Pro';

          return 'Veuillez saisir une date de naissance valide';
        },
      },
    });
  };
}
