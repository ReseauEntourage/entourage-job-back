import { SetMetadata } from '@nestjs/common';

export const TIMEOUT_KEY = 'timeout';
export const Timeout = (timeout: number) => SetMetadata(TIMEOUT_KEY, timeout);
