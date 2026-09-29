import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_PASSWORD_KEY = 'allowWithoutPassword';

/**
 * Marks an authenticated route as reachable by a session whose account has no
 * password yet. Every other authenticated route answers
 * `403 PASSWORD_SETUP_REQUIRED` to such a session (see `JwtAuthGuard`).
 */
export const AllowWithoutPassword = () =>
  SetMetadata(ALLOW_WITHOUT_PASSWORD_KEY, true);
