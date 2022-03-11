import { SetMetadata } from '@nestjs/common';

export const SELF_KEY = 'self';
export const Self = (selfIdKey: string) => SetMetadata(SELF_KEY, selfIdKey);
