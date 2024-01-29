import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as _ from 'lodash';
import { Permissions } from '../users.types';
import {
  getCandidateIdFromCoachOrCandidate,
  hasPermission,
} from '../users.utils';
import { LINKED_USER_KEY } from './linked-user.decorator';

@Injectable()
export class LinkedUserGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const linkedUserIdKey = this.reflector.get<string>(
      LINKED_USER_KEY,
      context.getHandler()
    );

    if (!linkedUserIdKey) {
      return false;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const requestId = _.get(request, linkedUserIdKey);
    const candidateId = getCandidateIdFromCoachOrCandidate(user);
    return (
      (Array.isArray(candidateId)
        ? candidateId.includes(requestId)
        : candidateId === requestId) ||
      user.id === requestId ||
      hasPermission(Permissions.ADMIN, user.role)
    );
  }
}
