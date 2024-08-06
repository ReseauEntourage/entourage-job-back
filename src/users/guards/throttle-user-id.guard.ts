/* eslint-disable @typescript-eslint/no-explicit-any */
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

const LIMIT = 10;
const TTL = 86400;

@Injectable()
export class ThrottleUserIdGuard extends ThrottlerGuard {
  async handleRequest(context: ExecutionContext): Promise<boolean> {
    const { req, res } = this.getRequestResponse(context);

    // Return early if the current user agent should be ignored.
    if (Array.isArray(this.options.ignoreUserAgents)) {
      for (const pattern of this.options.ignoreUserAgents) {
        if (pattern.test(req.headers['user-agent'])) {
          return true;
        }
      }
    }

    // Tracker for user id
    const tracker = this.getTracker(req);
    const key = this.generateKey(context, tracker);
    const { totalHits, timeToExpire } = await this.storageService.increment(
      key,
      TTL
    );

    // Tracker for userId
    const userIdTracker = this.getNameTracker(req);
    const nameKey = this.generateKey(context, userIdTracker);
    const { totalHits: totalHitsName, timeToExpire: timeToExpireName } =
      await this.storageService.increment(nameKey, TTL);

    // Throw an Error when user reached their Limit.
    if (totalHitsName > LIMIT) {
      res.header('Retry-After', timeToExpireName);
      this.throwThrottlingException(context);
    }

    res.header(`${this.headerPrefix}-Limit`, LIMIT);
    res.header(
      `${this.headerPrefix}-Remaining`,
      Math.max(0, LIMIT - totalHits)
    );
    res.header(`${this.headerPrefix}-Reset`, timeToExpire);

    return true;
  }

  protected getNameTracker(req: Record<string, any>): string {
    return req.user.id;
  }
}
