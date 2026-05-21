import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { ShareChannel } from './models/user-profile-share.model';
import { UserProfileSharesService } from './user-profile-shares.service';

@ApiTags('UserProfileShares')
@Controller()
export class UserProfileSharesController {
  constructor(
    private readonly userProfileSharesService: UserProfileSharesService
  ) {}

  @Post('user/profile/:profileUserId/shares')
  async recordShare(
    @UserPayload('id', new ParseUUIDPipe()) sharingUserId: string,
    @Param('profileUserId', new ParseUUIDPipe()) sharedUserId: string,
    @Body('channel') channel: ShareChannel,
    @Body('postUrl') postUrl?: string
  ) {
    const share = await this.userProfileSharesService.create({
      sharedUserId,
      sharingUserId,
      channel,
      postUrl,
    });
    return { success: true, shareId: share.id };
  }

  @Get('user/profile/:profileUserId/shares')
  async getSharesReceived(
    @Param('profileUserId', new ParseUUIDPipe()) sharedUserId: string
  ) {
    return this.userProfileSharesService.findReceivedByUserId(sharedUserId);
  }

  @Get('user/shares/sent')
  async getSharesSent(
    @UserPayload('id', new ParseUUIDPipe()) sharingUserId: string
  ) {
    return this.userProfileSharesService.findSentByUserId(sharingUserId);
  }
}
