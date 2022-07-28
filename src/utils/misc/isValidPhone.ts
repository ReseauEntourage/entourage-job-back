import { phone } from 'phone';

export function isValidPhone(phoneNumber: string) {
  if (!phoneNumber) {
    return false;
  }
  const { isValid } = phone(phoneNumber);
  return phoneNumber.includes('+') && isValid;
}
