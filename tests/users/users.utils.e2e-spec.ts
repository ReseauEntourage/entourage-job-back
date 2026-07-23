import { UserRoles } from 'src/users/users.types';
import { isEntourageAdmin } from 'src/users/users.utils';

describe('isEntourageAdmin', () => {
  it('returns true for the Admin role', () => {
    expect(isEntourageAdmin(UserRoles.ADMIN)).toBe(true);
  });

  it.each(Object.values(UserRoles).filter((role) => role !== UserRoles.ADMIN))(
    'returns false for the %s role',
    (role) => {
      expect(isEntourageAdmin(role)).toBe(false);
    }
  );
});
