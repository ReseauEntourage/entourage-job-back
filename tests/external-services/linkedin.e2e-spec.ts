import {
  BadRequestException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LinkedInController } from 'src/external-services/linkedin/linkedin.controller';
import { LinkedInService } from 'src/external-services/linkedin/linkedin.service';

const mockPost = jest.fn();
const mockGet = jest.fn();

// LinkedIn is never reached: axios is replaced by a double.
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
  isAxiosError: (error: unknown) =>
    !!(error as { isAxiosError?: boolean })?.isAxiosError,
}));

const ENV_KEYS = [
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'LINKEDIN_REDIRECT_URI',
  'FRONT_URL',
];

describe('LinkedIn', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key];
    });
    process.env.LINKEDIN_CLIENT_ID = 'client-id';
    process.env.LINKEDIN_CLIENT_SECRET = 'client-secret';
    process.env.LINKEDIN_REDIRECT_URI = 'https://front.example.org/callback';
    process.env.FRONT_URL = 'https://front.example.org';
  });

  afterAll(() => {
    ENV_KEYS.forEach((key) => {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    });
  });

  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
  });

  const build = () => {
    const usersService = {
      update: jest.fn().mockResolvedValue(undefined),
      findOneWithAttributes: jest.fn(),
    };
    const userProfilesService = {
      getShareText: jest.fn().mockResolvedValue('Generated text'),
    };
    const userProfileSharesService = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const service = new LinkedInService(
      usersService as never,
      userProfilesService as never,
      userProfileSharesService as never
    );
    return {
      service,
      usersService,
      userProfilesService,
      userProfileSharesService,
    };
  };

  describe('LinkedInService', () => {
    describe('OAuth url and state', () => {
      it('builds the authorization url with the requested scopes and the state', () => {
        const { service } = build();

        const url = new URL(service.buildOAuthUrl('some-state'));

        expect(url.origin + url.pathname).toBe(
          'https://www.linkedin.com/oauth/v2/authorization'
        );
        expect(Object.fromEntries(url.searchParams)).toEqual({
          response_type: 'code',
          client_id: 'client-id',
          redirect_uri: 'https://front.example.org/callback',
          scope: 'openid profile w_member_social',
          state: 'some-state',
        });
      });

      it('encodes and decodes the state', () => {
        const { service } = build();

        const state = service.encodeState({ redirectAfterShare: 'user-1' });

        expect(service.decodeState(state)).toEqual({
          redirectAfterShare: 'user-1',
        });
      });

      it('decodes a tampered state as an empty one', () => {
        const { service } = build();

        expect(service.decodeState('%%% not base64 json')).toEqual({});
      });
    });

    describe('exchangeCodeForToken', () => {
      it('exchanges the code then reads the LinkedIn id of the member', async () => {
        const { service } = build();
        mockPost.mockResolvedValue({
          data: {
            access_token: 'access',
            refresh_token: 'refresh',
            expires_in: 3600,
          },
        });
        mockGet.mockResolvedValue({ data: { sub: 'li-123' } });
        const before = Date.now();

        const token = await service.exchangeCodeForToken('the-code');

        const [, params] = mockPost.mock.calls[0];
        expect(Object.fromEntries(params)).toEqual({
          grant_type: 'authorization_code',
          code: 'the-code',
          redirect_uri: 'https://front.example.org/callback',
          client_id: 'client-id',
          client_secret: 'client-secret',
        });
        expect(mockGet).toHaveBeenCalledWith(
          'https://api.linkedin.com/v2/userinfo',
          { headers: { Authorization: 'Bearer access' } }
        );
        expect(token).toEqual({
          accessToken: 'access',
          refreshToken: 'refresh',
          linkedinId: 'li-123',
          expiresAt: expect.any(Date),
        });
        expect(token.expiresAt.getTime()).toBeGreaterThanOrEqual(
          before + 3600 * 1000
        );
      });

      it('stores a missing refresh token as null', async () => {
        const { service } = build();
        mockPost.mockResolvedValue({
          data: { access_token: 'access', expires_in: 10 },
        });
        mockGet.mockResolvedValue({ data: { sub: 'li-123' } });

        const token = await service.exchangeCodeForToken('code');

        expect(token.refreshToken).toBeNull();
      });
    });

    it('stores and removes the LinkedIn token of a user', async () => {
      const { service, usersService } = build();
      const expiresAt = new Date();

      await service.storeToken('user-1', {
        accessToken: 'a',
        refreshToken: null,
        expiresAt,
        linkedinId: 'li',
      });
      await service.unlinkAccount('user-1');

      expect(usersService.update).toHaveBeenNthCalledWith(1, 'user-1', {
        linkedinId: 'li',
        linkedinAccessToken: 'a',
        linkedinRefreshToken: null,
        linkedinTokenExpiresAt: expiresAt,
      });
      expect(usersService.update).toHaveBeenNthCalledWith(2, 'user-1', {
        linkedinId: null,
        linkedinAccessToken: null,
        linkedinRefreshToken: null,
        linkedinTokenExpiresAt: null,
      });
    });

    describe('shareProfile', () => {
      const linkedUser = {
        id: 'sharer',
        linkedinId: 'li-1',
        linkedinAccessToken: 'token',
        linkedinTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      };

      it('refuses to share when no LinkedIn account is linked', async () => {
        const { service, usersService } = build();
        usersService.findOneWithAttributes.mockResolvedValue({
          id: 'sharer',
          linkedinAccessToken: null,
        });

        await expect(service.shareProfile('sharer', 'profile')).rejects.toThrow(
          UnauthorizedException
        );
        expect(mockPost).not.toHaveBeenCalled();
      });

      it('refuses to share with an expired token', async () => {
        const { service, usersService } = build();
        usersService.findOneWithAttributes.mockResolvedValue({
          ...linkedUser,
          linkedinTokenExpiresAt: new Date(Date.now() - 1000),
        });

        await expect(service.shareProfile('sharer', 'profile')).rejects.toThrow(
          'LinkedIn token expired'
        );
      });

      it('publishes a post with the generated text and an article, then records the share', async () => {
        const {
          service,
          usersService,
          userProfileSharesService,
          userProfilesService,
        } = build();
        usersService.findOneWithAttributes.mockResolvedValue(linkedUser);
        mockPost.mockResolvedValue({
          headers: { 'x-linkedin-id': 'urn:li:share:99' },
        });

        const postUrl = await service.shareProfile('sharer', 'profile-1');

        expect(userProfilesService.getShareText).toHaveBeenCalledWith(
          'profile-1',
          'linkedin'
        );
        const [url, body, options] = mockPost.mock.calls[0];
        expect(url).toBe('https://api.linkedin.com/rest/posts');
        expect(body).toEqual(
          expect.objectContaining({
            author: 'urn:li:person:li-1',
            commentary: 'Generated text',
            visibility: 'PUBLIC',
            lifecycleState: 'PUBLISHED',
            content: {
              article: expect.objectContaining({
                source: 'https://front.example.org/cv/profile-1',
              }),
            },
          })
        );
        expect(options.headers.Authorization).toBe('Bearer token');
        expect(postUrl).toBe(
          'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A99'
        );
        expect(userProfileSharesService.create).toHaveBeenCalledWith({
          sharedUserId: 'profile-1',
          sharingUserId: 'sharer',
          channel: 'linkedin',
          postUrl,
        });
      });

      it('uses the custom text instead of the generated one', async () => {
        const { service, usersService, userProfilesService } = build();
        usersService.findOneWithAttributes.mockResolvedValue(linkedUser);
        mockPost.mockResolvedValue({ headers: {} });

        await service.shareProfile('sharer', 'profile-1', 'My own words');

        expect(userProfilesService.getShareText).not.toHaveBeenCalled();
        expect(mockPost.mock.calls[0][1].commentary).toBe('My own words');
      });

      it('records the share without url when LinkedIn returns no post id', async () => {
        const { service, usersService, userProfileSharesService } = build();
        usersService.findOneWithAttributes.mockResolvedValue(linkedUser);
        mockPost.mockResolvedValue({ headers: {} });

        const postUrl = await service.shareProfile('sharer', 'profile-1');

        expect(postUrl).toBe('');
        expect(userProfileSharesService.create).toHaveBeenCalledWith(
          expect.objectContaining({ postUrl: undefined })
        );
      });

      it('does not attach an article to a local front url', async () => {
        process.env.FRONT_URL = 'http://localhost:3000';
        try {
          const { service, usersService } = build();
          usersService.findOneWithAttributes.mockResolvedValue(linkedUser);
          mockPost.mockResolvedValue({ headers: {} });

          await service.shareProfile('sharer', 'profile-1');

          expect(mockPost.mock.calls[0][1]).not.toHaveProperty('content');
        } finally {
          process.env.FRONT_URL = 'https://front.example.org';
        }
      });

      it('maps a LinkedIn 422 to an unprocessable entity error and does not record the share', async () => {
        const { service, usersService, userProfileSharesService } = build();
        usersService.findOneWithAttributes.mockResolvedValue(linkedUser);
        mockPost.mockRejectedValue({
          isAxiosError: true,
          response: { status: 422 },
        });

        await expect(
          service.shareProfile('sharer', 'profile-1')
        ).rejects.toThrow(UnprocessableEntityException);
        expect(userProfileSharesService.create).not.toHaveBeenCalled();
      });

      it('maps any other failure to a bad request', async () => {
        const { service, usersService } = build();
        usersService.findOneWithAttributes.mockResolvedValue(linkedUser);
        mockPost.mockRejectedValue(new Error('network'));

        await expect(
          service.shareProfile('sharer', 'profile-1')
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('LinkedInController', () => {
    const buildController = () => {
      const linkedInService = {
        encodeState: jest.fn().mockReturnValue('encoded'),
        buildOAuthUrl: jest.fn().mockReturnValue('https://linkedin/auth'),
        decodeState: jest.fn().mockReturnValue({ redirectAfterShare: 'p1' }),
        exchangeCodeForToken: jest.fn().mockResolvedValue({ accessToken: 'a' }),
        storeToken: jest.fn().mockResolvedValue(undefined),
        unlinkAccount: jest.fn().mockResolvedValue(undefined),
        shareProfile: jest.fn().mockResolvedValue('https://post'),
      };
      return {
        controller: new LinkedInController(linkedInService as never),
        linkedInService,
      };
    };

    it('returns the OAuth url carrying the redirect in its state', () => {
      const { controller, linkedInService } = buildController();

      expect(controller.getOAuthUrl('profile-1')).toEqual({
        url: 'https://linkedin/auth',
      });
      expect(linkedInService.encodeState).toHaveBeenCalledWith({
        redirectAfterShare: 'profile-1',
      });
      expect(linkedInService.buildOAuthUrl).toHaveBeenCalledWith('encoded');
    });

    it('exchanges the code, stores the token and returns the pending share', async () => {
      const { controller, linkedInService } = buildController();

      const result = await controller.exchangeCode('user-1', 'code', 'state');

      expect(linkedInService.storeToken).toHaveBeenCalledWith('user-1', {
        accessToken: 'a',
      });
      expect(result).toEqual({ pendingShare: 'p1' });
    });

    it('rejects an exchange without code', async () => {
      const { controller, linkedInService } = buildController();

      await expect(
        controller.exchangeCode('user-1', '', 'state')
      ).rejects.toThrow('Missing authorization code');
      expect(linkedInService.exchangeCodeForToken).not.toHaveBeenCalled();
    });

    it('hides the cause of an exchange failure', async () => {
      const { controller, linkedInService } = buildController();
      linkedInService.exchangeCodeForToken.mockRejectedValue(
        new Error('secret')
      );

      await expect(
        controller.exchangeCode('user-1', 'code', undefined)
      ).rejects.toThrow('Failed to exchange LinkedIn token');
      expect(linkedInService.decodeState).toHaveBeenCalledWith('');
    });

    it('unlinks the account', async () => {
      const { controller, linkedInService } = buildController();

      await expect(controller.unlinkAccount('user-1')).resolves.toEqual({
        success: true,
      });
      expect(linkedInService.unlinkAccount).toHaveBeenCalledWith('user-1');
    });

    it('shares a profile and returns the LinkedIn post url', async () => {
      const { controller, linkedInService } = buildController();

      await expect(
        controller.shareProfile('user-1', 'profile-1', 'text')
      ).resolves.toEqual({ success: true, linkedinPostUrl: 'https://post' });
      expect(linkedInService.shareProfile).toHaveBeenCalledWith(
        'user-1',
        'profile-1',
        'text'
      );
    });
  });
});
