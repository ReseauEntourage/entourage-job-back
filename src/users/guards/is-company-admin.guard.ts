import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { User } from '../models';
import { UsersService } from '../users.service';

@Injectable()
export class IsCompanyAdminGuard implements CanActivate {
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    let user: User = request.user;
    const companyId = request.params.companyId;

    if (!companyId || !user) {
      return false;
    }

    // Ensure user is fully loaded with company users
    user = await this.usersService.findOneWithCompanyUsers(user.id);

    return user.companyUsers.some(
      (companyUser) =>
        companyUser.companyId === companyId && companyUser.isAdmin
    );
  }
}
