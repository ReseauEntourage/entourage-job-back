import { PublicStaffContact } from 'src/utils/types/zones.types';

export type StaffContactDto = PublicStaffContact;

export const generateStaffContactDto = (
  staffContact: PublicStaffContact
): StaffContactDto => {
  return {
    name: staffContact.name,
    email: staffContact.email,
    img: staffContact.img,
  };
};
