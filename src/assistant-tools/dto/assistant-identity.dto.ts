import { ApiProperty } from '@nestjs/swagger';
import { UserRoles } from 'src/users/users.types';
import type { UserRole } from 'src/users/users.types';

/**
 * Identity of the user behind the token, as read by the AI assistant.
 * Built field by field: never copy `request.user` into it (it carries the
 * e-mail address).
 */
export class AssistantIdentityDto {
  @ApiProperty({
    description: 'First name of the user, empty when it is not filled in.',
  })
  firstName: string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    description:
      'Role of the user. The assistant must treat it as an opaque string.',
    enum: Object.values(UserRoles),
  })
  role: UserRole;
}

export const generateAssistantIdentityDto = (
  id: string,
  role: UserRole,
  firstName: string | null | undefined
): AssistantIdentityDto => ({
  id,
  firstName: firstName ?? '',
  role,
});
