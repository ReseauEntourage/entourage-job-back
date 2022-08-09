import { pbkdf2Sync, randomBytes } from 'crypto';
import { User } from '../users/models';
import { PayloadUser } from './auth.types';

export function getPartialUserForPayload(user: User): PayloadUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    gender: user.gender,
    phone: user.phone,
    address: user.address,
    zone: user.zone,
    role: user.role,
    adminRole: user.adminRole,
    candidat: user.candidat,
    coach: user.coach,
    lastConnection: user.lastConnection,
    /*
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.createdAt,
    */
  };
}

export function encryptPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');

  return {
    salt,
    hash,
  };
}

export function validatePassword(password: string, hash: string, salt: string) {
  const passwordHash = pbkdf2Sync(
    password,
    salt,
    10000,
    512,
    'sha512'
  ).toString('hex');

  return passwordHash === hash;
}
