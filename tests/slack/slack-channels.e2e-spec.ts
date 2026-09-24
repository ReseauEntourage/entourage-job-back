import { Logger } from '@nestjs/common';
import { SlackService } from 'src/external-services/slack/slack.service';
import {
  slackChannelEnvVars,
  slackChannels,
} from 'src/external-services/slack/slack.types';

describe('Slack channels', () => {
  const envVars = ['NODE_ENV', ...Object.values(slackChannelEnvVars)];
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = Object.fromEntries(
      envVars.map((key) => [key, process.env[key]])
    );
    Object.values(slackChannelEnvVars).forEach(
      (key) => delete process.env[key]
    );
  });

  afterEach(() => {
    Object.entries(savedEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    jest.restoreAllMocks();
  });

  describe('slackChannels', () => {
    it('should use the configured channels when env vars are set', () => {
      process.env.SLACK_CHANNEL_MODERATION = 'staging-moderation';
      process.env.SLACK_CHANNEL_TECH_MONITORING = 'staging-tech';
      process.env.SLACK_CHANNEL_ACHIEVEMENTS = 'staging-badges';

      expect(slackChannels.ENTOURAGE_PRO_MODERATION).toBe('staging-moderation');
      expect(slackChannels.TECH_PRO_MONITORING).toBe('staging-tech');
      expect(slackChannels.PRO_FOLLOW_ACHIEVEMENTS).toBe('staging-badges');
    });

    it('should fall back to the dev channels when env vars are unset', () => {
      expect(slackChannels.ENTOURAGE_PRO_MODERATION).toBe(
        'dev-moderation_entourage-pro'
      );
      expect(slackChannels.TECH_PRO_MONITORING).toBe('tech-pro-monitoring-dev');
      expect(slackChannels.PRO_FOLLOW_ACHIEVEMENTS).toBe(
        'dev-entourage-pro-suivi-badges'
      );
    });

    it('should fall back to the dev channel when an env var is empty', () => {
      process.env.SLACK_CHANNEL_MODERATION = '';

      expect(slackChannels.ENTOURAGE_PRO_MODERATION).toBe(
        'dev-moderation_entourage-pro'
      );
    });

    it('should not depend on NODE_ENV', () => {
      process.env.NODE_ENV = 'production';

      expect(slackChannels.PRO_FOLLOW_ACHIEVEMENTS).toBe(
        'dev-entourage-pro-suivi-badges'
      );

      process.env.SLACK_CHANNEL_ACHIEVEMENTS = 'staging-badges';
      expect(slackChannels.PRO_FOLLOW_ACHIEVEMENTS).toBe('staging-badges');
    });
  });

  describe('SlackService - warnOnMissingChannelConfig', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
    });

    it('should warn with the missing env vars in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.SLACK_CHANNEL_MODERATION = 'moderation';
      process.env.SLACK_CHANNEL_TECH_MONITORING = 'tech';

      new SlackService().warnOnMissingChannelConfig();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('SLACK_CHANNEL_ACHIEVEMENTS');
      expect(warnSpy.mock.calls[0][0]).not.toContain(
        'SLACK_CHANNEL_MODERATION'
      );
    });

    it('should not warn in production when all env vars are set', () => {
      process.env.NODE_ENV = 'production';
      process.env.SLACK_CHANNEL_MODERATION = 'moderation';
      process.env.SLACK_CHANNEL_TECH_MONITORING = 'tech';
      process.env.SLACK_CHANNEL_ACHIEVEMENTS = 'badges';

      new SlackService().warnOnMissingChannelConfig();

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should not warn outside production', () => {
      process.env.NODE_ENV = 'development';

      new SlackService().warnOnMissingChannelConfig();

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
