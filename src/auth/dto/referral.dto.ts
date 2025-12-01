import { Referral } from 'src/utils/types/zones.types';

export interface ReferralDto {
  name: string;
  email: string;
  img: string;
}

export const generateReferralDto = (referral: Referral): ReferralDto => {
  return {
    name: referral.name,
    email: referral.email,
    img: referral.img,
  };
};
