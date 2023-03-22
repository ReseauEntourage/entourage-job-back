import { pbkdf2Sync, randomBytes } from 'crypto';
import { User } from 'src/users/models';
import { PayloadUser } from './auth.types';

export function getTokenFromHeaders(
  req: Request & { headers: Request['headers'] & { authorization: string } }
) {
  const {
    headers: { authorization },
  } = req;

  if (authorization && authorization.split(' ')[0] === 'Token') {
    return authorization.split(' ')[1];
  }
  return null;
}

export function getPartialUserForPayload(user: User): PayloadUser {
  const {
    id,
    email,
    firstName,
    lastName,
    gender,
    phone,
    address,
    zone,
    role,
    adminRole,
    lastConnection,
    coaches,
    candidat,
  } = user;

  const commonAttributes = {
    id: id,
    email: email,
    firstName: firstName,
    lastName: lastName,
    gender: gender,
    phone: phone,
    address: address,
    zone: zone,
    role: role,
    adminRole: adminRole,
    lastConnection: lastConnection,
  };

  if (coaches && coaches.length > 0) {
    const restCoaches = coaches.map((coach) => {
      const { note, ...restCoach } = coach;
      return restCoach;
    });
    return {
      ...commonAttributes,
      coaches: restCoaches,
    };
  }
  if (candidat) {
    const { note, ...restCandidate } = candidat;
    return {
      ...commonAttributes,
      candidat: restCandidate,
    };
  }

  return commonAttributes;
}

const ITERATIONS = 10000;

export function encryptPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, 512, 'sha512').toString(
    'hex'
  );

  return {
    salt,
    hash,
  };
}

export function validatePassword(password: string, hash: string, salt: string) {
  const passwordHash = pbkdf2Sync(
    password,
    salt,
    ITERATIONS,
    512,
    'sha512'
  ).toString('hex');

  return passwordHash === hash;
}
