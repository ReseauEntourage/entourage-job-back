import { generateCurrentUserIdentityDto } from 'src/current-user/dto/current-user-identity.dto';
import { User } from 'src/users/models';

const DAY_MS = 24 * 60 * 60 * 1000;

const buildUser = (overrides: Partial<User>): User =>
  ({ id: 'user-id', featureFlags: [], ...overrides }) as unknown as User;

describe('generateCurrentUserIdentityDto - hasLinkedinLinked', () => {
  it('should be true when the LinkedIn token has not expired', () => {
    const dto = generateCurrentUserIdentityDto(
      buildUser({
        linkedinAccessToken: 'token',
        linkedinTokenExpiresAt: new Date(Date.now() + DAY_MS),
      })
    );

    expect(dto.hasLinkedinLinked).toBe(true);
  });

  it('should be false when the LinkedIn token has expired', () => {
    const dto = generateCurrentUserIdentityDto(
      buildUser({
        linkedinAccessToken: 'token',
        linkedinTokenExpiresAt: new Date(Date.now() - DAY_MS),
      })
    );

    expect(dto.hasLinkedinLinked).toBe(false);
  });

  it('should be true when a token has no recorded expiration date', () => {
    const dto = generateCurrentUserIdentityDto(
      buildUser({ linkedinAccessToken: 'token', linkedinTokenExpiresAt: null })
    );

    expect(dto.hasLinkedinLinked).toBe(true);
  });

  it('should be false when no LinkedIn account is linked', () => {
    const dto = generateCurrentUserIdentityDto(
      buildUser({ linkedinAccessToken: null, linkedinTokenExpiresAt: null })
    );

    expect(dto.hasLinkedinLinked).toBe(false);
  });
});
