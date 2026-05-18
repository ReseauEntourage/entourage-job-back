import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public, UserPayload } from 'src/auth/guards';
import { LinkedInService } from './linkedin.service';

@ApiTags('LinkedIn')
@Controller()
export class LinkedInController {
  private readonly logger = new Logger(LinkedInController.name);
  constructor(private readonly linkedInService: LinkedInService) {}

  @Get('auth/linkedin/url')
  getOAuthUrl(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Query('redirectAfterShare') redirectAfterShare?: string
  ) {
    const state = this.linkedInService.encodeState({
      userId,
      redirectAfterShare,
    });
    const url = this.linkedInService.buildOAuthUrl(state);
    return { url };
  }

  @Public()
  @Post('auth/linkedin/exchange')
  async exchangeCode(
    @Body('code') code: string,
    @Body('state') state: string
  ): Promise<{ pendingShare?: string }> {
    if (!code) {
      throw new BadRequestException('Missing authorization code');
    }

    const stateData = this.linkedInService.decodeState(state ?? '');

    if (!stateData.userId) {
      throw new BadRequestException('Invalid state');
    }

    try {
      const tokenData = await this.linkedInService.exchangeCodeForToken(code);
      await this.linkedInService.storeToken(stateData.userId, tokenData);
      return { pendingShare: stateData.redirectAfterShare };
    } catch (err) {
      this.logger.error(
        `LinkedIn token exchange failed for user ${stateData.userId}`,
        err instanceof Error ? err.stack : JSON.stringify(err)
      );
      throw new BadRequestException('Failed to exchange LinkedIn token');
    }
  }

  @Delete('auth/linkedin')
  async unlinkAccount(@UserPayload('id', new ParseUUIDPipe()) userId: string) {
    await this.linkedInService.unlinkAccount(userId);
    return { success: true };
  }

  @Post('linkedin/share/:profileUserId')
  async shareProfile(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('profileUserId', new ParseUUIDPipe()) profileUserId: string
  ) {
    await this.linkedInService.shareProfile(userId, profileUserId);
    return { success: true };
  }
}
