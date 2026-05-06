import { Controller, Get, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserPayload } from 'src/auth/guards';
import { User } from 'src/users/models';
import { CurrentUserService } from './current-user.service';

@ApiTags('CurrentUser')
@Throttle(60, 60)
@ApiBearerAuth()
@Controller('current')
export class CurrentUserController {
  constructor(private readonly currentUserService: CurrentUserService) {}

  @Get()
  async getIdentity(@UserPayload('id', new ParseUUIDPipe()) id: string) {
    return this.currentUserService.getIdentity(id);
  }

  @Get('profile')
  async getProfile(@UserPayload('id', new ParseUUIDPipe()) id: string) {
    return this.currentUserService.getProfile(id);
  }

  @Get('profile/complete')
  async getProfileComplete(@UserPayload('id', new ParseUUIDPipe()) id: string) {
    return this.currentUserService.getProfileComplete(id);
  }

  @Get('company')
  async getCompany(@UserPayload('id', new ParseUUIDPipe()) id: string) {
    return this.currentUserService.getCompany(id);
  }

  @Get('organization')
  async getOrganization(@UserPayload('id', new ParseUUIDPipe()) id: string) {
    return this.currentUserService.getOrganization(id);
  }

  @Get('stats')
  async getStats(
    @UserPayload('id', new ParseUUIDPipe()) id: string,
    @UserPayload('role') role: User['role']
  ) {
    return this.currentUserService.getStats(id, role);
  }

  @Get('whatsapp-zone')
  async getWhatsappZone(@UserPayload('id', new ParseUUIDPipe()) id: string) {
    return this.currentUserService.getWhatsappZone(id);
  }

  @Get('staff-contact')
  async getStaffContact(@UserPayload('id', new ParseUUIDPipe()) id: string) {
    return this.currentUserService.getStaffContact(id);
  }

  @Get('referred-users')
  async getReferredUsers(@UserPayload('id', new ParseUUIDPipe()) id: string) {
    return this.currentUserService.getReferredUsers(id);
  }

  @Get('referrer')
  async getReferrer(@UserPayload('id', new ParseUUIDPipe()) id: string) {
    return this.currentUserService.getReferrer(id);
  }

  @Get('achievements')
  async getAchievements(@UserPayload('id', new ParseUUIDPipe()) id: string) {
    return this.currentUserService.getAchievements(id);
  }

  @Get('read-documents')
  async getReadDocuments(@UserPayload('id', new ParseUUIDPipe()) id: string) {
    return this.currentUserService.getReadDocuments(id);
  }
}
