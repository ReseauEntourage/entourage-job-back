import { SetMetadata } from '@nestjs/common';

export const LINKED_USER_KEY = 'linkedUser';
export const LinkedUser = (linkedUserIdKey: string) =>
  SetMetadata(LINKED_USER_KEY, linkedUserIdKey);
