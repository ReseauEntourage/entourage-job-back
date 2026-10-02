import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { isProfileVisibilityEligible } from 'src/user-profiles/user-profiles.utils';
import { User } from 'src/users/models';
import { UserRole, UserRoles } from 'src/users/users.types';
import { isEntourageAdmin } from 'src/users/users.utils';
import { PostAuthor } from './posts.types';

export interface PostCursor {
  date: Date;
  id: string;
}

const CURSOR_SEPARATOR = '_';

/**
 * Encodes a `(sort date, id)` pair as a single opaque, query-string safe
 * pagination cursor (same format as the messaging cursors).
 */
export const encodePostCursor = (cursor: PostCursor): string => {
  return Buffer.from(
    `${cursor.date.toISOString()}${CURSOR_SEPARATOR}${cursor.id}`
  ).toString('base64url');
};

export const decodePostCursor = (rawCursor: string): PostCursor => {
  const decoded = Buffer.from(rawCursor, 'base64url').toString('utf-8');
  const separatorIndex = decoded.lastIndexOf(CURSOR_SEPARATOR);
  if (separatorIndex === -1) {
    throw new BadRequestException('Invalid cursor');
  }
  const date = new Date(decoded.slice(0, separatorIndex));
  const id = decoded.slice(separatorIndex + 1);
  if (Number.isNaN(date.getTime()) || !isUUID(id, 4)) {
    throw new BadRequestException('Invalid cursor');
  }
  return { date, id };
};

/**
 * Parses an optional `limit` query param, falling back to the default and
 * capping it to the maximum.
 */
export const parsePageLimit = (
  rawLimit: string | undefined,
  defaultLimit: number,
  maxLimit: number
): number => {
  if (rawLimit === undefined || rawLimit === '') {
    return defaultLimit;
  }
  // The whole value must be a positive integer (`parseInt` would accept `2abc`)
  if (!/^\d+$/.test(rawLimit)) {
    throw new BadRequestException('Invalid limit');
  }
  const limit = parseInt(rawLimit, 10);
  if (limit < 1) {
    throw new BadRequestException('Invalid limit');
  }
  return Math.min(limit, maxLimit);
};

export const RoleLabels: { [K in UserRole]: string } = {
  [UserRoles.CANDIDATE]: 'Candidat',
  [UserRoles.COACH]: 'Coach',
  [UserRoles.REFERER]: 'Prescripteur',
  [UserRoles.ADMIN]: 'Équipe Entourage',
};

// Roles which own a profile page (`/backoffice/profile/:id`)
const RolesWithProfilePage: UserRole[] = [
  UserRoles.CANDIDATE,
  UserRoles.COACH,
  UserRoles.REFERER,
];

export type PostAuthorSource = Pick<
  User,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'role'
  | 'deletedAt'
  | 'onboardingStatus'
  | 'elearningCompletedAt'
> & {
  userProfile?: { department?: string | null } | null;
};

/**
 * Builds the minimal author exposed to any logged-in reader: never the full
 * last name nor the email. A deleted author (read with `paranoid: false`)
 * keeps only its id and `isDeleted`.
 */
export const toPostAuthor = (
  author: PostAuthorSource,
  readerRole: UserRole,
  withLocation = false
): PostAuthor => {
  if (!author || author.deletedAt) {
    return {
      id: author?.id ?? null,
      firstName: null,
      lastNameInitial: null,
      roleLabel: null,
      isDeleted: true,
      profileLinkable: false,
    };
  }

  const profileLinkable =
    RolesWithProfilePage.includes(author.role) &&
    (isEntourageAdmin(readerRole) || isProfileVisibilityEligible(author));

  return {
    id: author.id,
    firstName: author.firstName,
    lastNameInitial: author.lastName
      ? `${author.lastName.trim().charAt(0).toUpperCase()}.`
      : null,
    roleLabel: RoleLabels[author.role] ?? null,
    isDeleted: false,
    profileLinkable,
    ...(withLocation && profileLinkable
      ? { department: author.userProfile?.department ?? null }
      : {}),
  };
};
