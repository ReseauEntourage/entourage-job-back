import { StaffContact } from 'src/utils/types/zones.types';

export interface StaffContactDto {
  name: string;
  email: string;
  img: string;
}

export const generateStaffContactDto = (
  staffContact: StaffContact
): StaffContactDto => {
  return {
    name: staffContact.name,
    email: staffContact.email,
    img: staffContact.img,
  };
};
