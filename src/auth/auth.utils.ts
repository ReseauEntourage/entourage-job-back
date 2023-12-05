import { pbkdf2Sync, randomBytes } from 'crypto';

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
