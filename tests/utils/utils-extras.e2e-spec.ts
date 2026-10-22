import fs from 'fs';
import { RedisKeys } from 'src/utils/constants/redis';
import { WhatsappCoachByZone } from 'src/utils/constants/whatsapp-groups';
import { Zones } from 'src/utils/constants/zones';
import { detectPdftocairoPath } from 'src/utils/misc/pdf-to-cairo';
import { trimString } from 'src/utils/transforms';
import { StaffContactGroup, ZoneName } from 'src/utils/types/zones.types';
import { convertYesNoToBoolean } from 'src/utils/yesNo';

describe('zones staff contacts', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('describes every zone with its three staff contacts', () => {
    for (const zoneName of Object.values(ZoneName)) {
      const zone = Zones[zoneName];
      expect(zone.name).toBe(zoneName);
      expect(zone.sfLocalBranchNames.length).toBeGreaterThanOrEqual(0);
      for (const group of Object.values(StaffContactGroup)) {
        expect(zone.staffContact[group].name).toEqual(expect.any(String));
      }
    }
  });

  it('builds the picture URLs from the S3 configuration, read lazily', () => {
    process.env.AWSS3_URL = 'https://s3.invalid/';
    process.env.AWSS3_IMAGE_DIRECTORY = 'images/';

    for (const zoneName of Object.values(ZoneName)) {
      for (const group of Object.values(StaffContactGroup)) {
        expect(Zones[zoneName].staffContact[group].img).toMatch(
          /^https:\/\/s3\.invalid\/images\/staff-pictures\/.+\.(jpg|png)$/
        );
      }
    }

    delete process.env.AWSS3_URL;
    delete process.env.AWSS3_IMAGE_DIRECTORY;
    expect(Zones[ZoneName.IDF].staffContact.coach.img).toBe(
      'staff-pictures/adele.jpg'
    );
  });

  it('reads the emails of each contact from the environment at access time', () => {
    for (const zoneName of Object.values(ZoneName)) {
      for (const group of Object.values(StaffContactGroup)) {
        const contact = Zones[zoneName].staffContact[group];
        // Every getter must resolve (value or undefined) without throwing
        expect(() => [
          contact.email,
          contact.slackEmail,
          contact.entourageProEmail,
        ]).not.toThrow();
      }
    }

    process.env.STAFF_CONTACT_COACH_EMAIL_PARIS = 'coach-paris@example.com';
    expect(Zones[ZoneName.IDF].staffContact.coach.email).toBe(
      'coach-paris@example.com'
    );
  });
});

describe('convertYesNoToBoolean', () => {
  it('maps yes/no to booleans and anything else to null', () => {
    expect(convertYesNoToBoolean('yes')).toBe(true);
    expect(convertYesNoToBoolean('no')).toBe(false);
    expect(convertYesNoToBoolean('jnspr')).toBeNull();
    expect(convertYesNoToBoolean(undefined)).toBeNull();
  });
});

describe('trimString', () => {
  it('trims strings and leaves other values untouched', () => {
    expect(trimString({ value: '  hello  ' })).toBe('hello');
    expect(trimString({ value: '   ' })).toBe('');
    expect(trimString({ value: 12 })).toBe(12);
    expect(trimString({ value: undefined })).toBeUndefined();
  });
});

describe('detectPdftocairoPath', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns the first existing candidate path', () => {
    jest
      .spyOn(fs, 'existsSync')
      .mockImplementation((path) => path === '/usr/local/bin/pdftocairo');

    expect(detectPdftocairoPath()).toBe('/usr/local/bin/pdftocairo');
  });

  it('throws when pdftocairo is installed nowhere', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(() => detectPdftocairoPath()).toThrow('pdftocairo introuvable');
  });
});

describe('constants', () => {
  it('exposes a namespaced redis key for the AI assistant rate limit', () => {
    expect(RedisKeys.RL_AI_ASSISTANT).toBe('rl-ai-assistant:');
  });

  it('declares a WhatsApp group (name and QR code) for every zone', () => {
    for (const zoneName of Object.values(ZoneName)) {
      expect(WhatsappCoachByZone[zoneName].name).toEqual(expect.any(String));
      expect(WhatsappCoachByZone[zoneName].qr).toMatch(/^\/static\/img\//);
    }
  });
});
