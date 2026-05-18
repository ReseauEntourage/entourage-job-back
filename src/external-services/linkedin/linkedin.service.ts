import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UsersService } from 'src/users/users.service';

const LINKEDIN_API_URL = 'https://api.linkedin.com';
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = `${LINKEDIN_API_URL}/v2/userinfo`;
const LINKEDIN_POSTS_URL = `${LINKEDIN_API_URL}/rest/posts`;
const LINKEDIN_API_VERSION = '202604';

export interface LinkedInOAuthState {
  userId?: string;
  redirectAfterShare?: string;
}

export interface LinkedInTokenData {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  linkedinId: string;
}

@Injectable()
export class LinkedInService {
  private readonly logger = new Logger(LinkedInService.name);
  constructor(
    private readonly usersService: UsersService,
    private readonly userProfilesService: UserProfilesService
  ) {}

  buildOAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      scope: 'openid profile w_member_social',
      state,
    });
    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  }

  encodeState(data: LinkedInOAuthState): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  decodeState(state: string): LinkedInOAuthState {
    try {
      return JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch {
      return {};
    }
  }

  async exchangeCodeForToken(code: string): Promise<LinkedInTokenData> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    });

    const tokenResponse = await axios.post(LINKEDIN_TOKEN_URL, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const userinfoResponse = await axios.get(LINKEDIN_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const linkedinId: string = userinfoResponse.data.sub;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    return {
      accessToken: access_token,
      refreshToken: refresh_token ?? null,
      expiresAt,
      linkedinId,
    };
  }

  async storeToken(
    userId: string,
    tokenData: LinkedInTokenData
  ): Promise<void> {
    await this.usersService.update(userId, {
      linkedinId: tokenData.linkedinId,
      linkedinAccessToken: tokenData.accessToken,
      linkedinRefreshToken: tokenData.refreshToken,
      linkedinTokenExpiresAt: tokenData.expiresAt,
    });
  }

  async unlinkAccount(userId: string): Promise<void> {
    await this.usersService.update(userId, {
      linkedinId: null,
      linkedinAccessToken: null,
      linkedinRefreshToken: null,
      linkedinTokenExpiresAt: null,
    });
  }

  async shareProfile(
    sharingUserId: string,
    profileUserId: string
  ): Promise<void> {
    const user = await this.usersService.findOneWithAttributes(sharingUserId, [
      'id',
      'linkedinId',
      'linkedinAccessToken',
      'linkedinTokenExpiresAt',
    ]);

    if (!user?.linkedinAccessToken) {
      throw new UnauthorizedException('LinkedIn account not linked');
    }

    if (
      user.linkedinTokenExpiresAt &&
      new Date(user.linkedinTokenExpiresAt) < new Date()
    ) {
      throw new UnauthorizedException(
        'LinkedIn token expired, please relink your account'
      );
    }

    const profileUrl = `${process.env.FRONT_URL}/cv/${profileUserId}`;
    const commentary = await this.userProfilesService.getShareText(
      profileUserId,
      'linkedin'
    );
    try {
      await axios.post(
        LINKEDIN_POSTS_URL,
        {
          author: `urn:li:person:${user.linkedinId}`,
          commentary,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          ...(profileUrl.startsWith('http://localhost')
            ? {}
            : {
                content: {
                  article: {
                    source: profileUrl,
                    title: `Entourage Pro - Aidez ce candidat a retrouver un emploi`,
                    description: `Decouvrez le profil et donnez-lui un coup de pouce !`,
                  },
                },
              }),
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        },
        {
          headers: {
            Authorization: `Bearer ${user.linkedinAccessToken}`,
            'LinkedIn-Version': LINKEDIN_API_VERSION,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to share profile on LinkedIn for user ${sharingUserId} and profile ${profileUserId}`,
        error instanceof Error ? error.stack : JSON.stringify(error)
      );
      throw new BadRequestException('Failed to share profile on LinkedIn');
    }
  }
}
