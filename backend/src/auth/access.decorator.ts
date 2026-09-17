import { SetMetadata } from '@nestjs/common';
import { ACCESS_POLICY_KEY, type AccessLevel } from './access-policy';

export function Access(level: AccessLevel) {
  return SetMetadata(ACCESS_POLICY_KEY, level);
}

