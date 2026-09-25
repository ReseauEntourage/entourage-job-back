import { createHash, pbkdf2Sync, randomBytes } from 'crypto';
import { Request } from 'express';

export function getTokenFromHeaders(req: Request) {
  const {
    headers: { authorization },
  } = req;

  if (authorization && authorization.split(' ')[0] === 'Bearer') {
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

/**
 * Whether an account has been finalized, shared by `finalize-account` and
 * `send-finalize-refered-user` so they never disagree.
 *
 * Both conditions are required, and this must not be reduced to
 * `isEmailVerified`: an account can have a verified email without ever having
 * picked a password (e.g. verified through the J+1 relaunch mail's autologin
 * link, before refered candidates were excluded from it), and such an account
 * must still be allowed to finalize.
 */
export function isAccountFinalized(user: {
  isEmailVerified: boolean;
  password?: string | null;
}) {
  return user.isEmailVerified && !!user.password;
}

export function encryptOtp(otp: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256')
    .update(otp + salt)
    .digest('hex');
  return { hash, salt };
}

export function validateOtp(otp: string, hash: string, salt: string) {
  const otpHash = createHash('sha256')
    .update(otp + salt)
    .digest('hex');
  return otpHash === hash;
}
