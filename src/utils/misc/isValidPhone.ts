import { phone } from 'phone';

export function isValidPhone(phoneNumber: string) {
  console.log(phoneNumber);
  if (!phoneNumber) {
    return false;
  }
  const { isValid } = phone(phoneNumber);
  return phoneNumber.includes('+') && isValid;
}
