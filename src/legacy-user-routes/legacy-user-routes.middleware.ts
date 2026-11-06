import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Temporary compatibility layer for EN-8409 (`/user` -> `/users`).
 *
 * The user routes were renamed to a plural, kebab-case convention (see the
 * `users-api-routes` spec). A browser tab left open on an older front bundle
 * keeps calling the old URLs, so each legacy path is rewritten to its new
 * route before routing. The first matching rule wins, so static paths come
 * before the `:id` ones. Remove this file once no legacy call is observed
 * (task 7.1 of the change `normalize-users-api-routes`).
 */
export const LEGACY_USER_ROUTE_RULES: ReadonlyArray<{
  pattern: RegExp;
  target: string;
}> = [
  {
    pattern: /^\/user\/profile\/completion$/,
    target: '/current/profile/completion',
  },
  {
    pattern: /^\/user\/profile\/recommendations$/,
    target: '/current/profile/recommendations',
  },
  {
    pattern: /^\/user\/profile\/refered$/,
    target: '/current/profile/referred-profiles',
  },
  {
    pattern: /^\/user\/profile\/upload-image$/,
    target: '/users/me/profile/image',
  },
  {
    pattern: /^\/user\/profile\/recommendations-ai\/([^/]+)$/,
    target: '/users/$1/profile/recommendations-ai',
  },
  { pattern: /^\/user\/profile$/, target: '/users/profiles' },
  {
    pattern: /^\/user\/profile\/([^/]+)\/(report|share-text|shares)$/,
    target: '/users/$1/profile/$2',
  },
  { pattern: /^\/user\/profile\/([^/]+)$/, target: '/users/$1/profile' },
  { pattern: /^\/user\/shares\/sent$/, target: '/current/shares/sent' },
  { pattern: /^\/user\/changePwd$/, target: '/users/me/password' },
  { pattern: /^\/user\/company$/, target: '/users/me/company' },
  { pattern: /^\/user\/refering$/, target: '/users/referrals' },
  // Everything else keeps its shape under the plural prefix.
  { pattern: /^\/user(\/.*)?$/, target: '/users$1' },
];

/**
 * Returns the new path for a legacy `/user...` path, or `null` when the path
 * is not a legacy one. The query string is handled by the caller.
 */
export function rewriteLegacyUserPath(pathname: string): string | null {
  for (const { pattern, target } of LEGACY_USER_ROUTE_RULES) {
    if (pattern.test(pathname)) {
      return pathname.replace(pattern, target);
    }
  }
  return null;
}

const logger = new Logger('LegacyUserRoutes');

/**
 * Express middleware, registered with `app.use()` (no mount path, so Express
 * does not strip the URL) before the Nest router. Every rewritten call is
 * logged as `LEGACY_USER_ROUTE`, which is what the observation period before
 * removal counts.
 */
export function legacyUserRoutesMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const [pathname, ...query] = req.url.split('?');
  const rewritten = rewriteLegacyUserPath(pathname);

  if (rewritten) {
    const queryString = query.length > 0 ? `?${query.join('?')}` : '';
    logger.warn(`LEGACY_USER_ROUTE ${req.method} ${pathname} -> ${rewritten}`);
    req.url = `${rewritten}${queryString}`;
  }

  next();
}
