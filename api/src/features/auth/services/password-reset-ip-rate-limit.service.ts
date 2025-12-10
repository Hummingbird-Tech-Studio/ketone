import { PASSWORD_RESET_IP_LIMIT, PASSWORD_RESET_IP_WINDOW_SECONDS } from '@ketone/shared';
import { Effect } from 'effect';
import { createIpRateLimitService } from '../../../lib/attempt-rate-limit';

export class PasswordResetIpRateLimitService extends Effect.Service<PasswordResetIpRateLimitService>()(
  'PasswordResetIpRateLimitService',
  {
    effect: createIpRateLimitService({
      limit: PASSWORD_RESET_IP_LIMIT,
      windowSeconds: PASSWORD_RESET_IP_WINDOW_SECONDS,
      serviceName: 'PasswordResetIpRateLimitService',
    }),
    accessors: true,
  },
) {}
