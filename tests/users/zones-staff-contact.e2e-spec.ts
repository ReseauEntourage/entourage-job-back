import { getZoneDisplayLabel, Zones } from 'src/utils/constants/zones';
import { StaffContactGroup, ZoneName } from 'src/utils/types/zones.types';

describe('Zones staff contact configuration', () => {
  it('gives a candidate referent distinct from the coach referent for a zone', () => {
    const idfStaffContact = Zones[ZoneName.IDF].staffContact;

    expect(idfStaffContact[StaffContactGroup.CANDIDATE].name).not.toBe(
      idfStaffContact[StaffContactGroup.COACH].name
    );
  });

  it('lets LORIENT inherit the same referents as BRETAGNE', () => {
    const lorientStaffContact = Zones[ZoneName.LORIENT].staffContact;
    const bretagneStaffContact = Zones[ZoneName.BRETAGNE].staffContact;

    expect(lorientStaffContact[StaffContactGroup.CANDIDATE].name).toBe(
      bretagneStaffContact[StaffContactGroup.CANDIDATE].name
    );
    expect(lorientStaffContact[StaffContactGroup.COACH].name).toBe(
      bretagneStaffContact[StaffContactGroup.COACH].name
    );
  });
});

describe('getZoneDisplayLabel', () => {
  it('returns "National" for the HZ zone', () => {
    expect(getZoneDisplayLabel(ZoneName.HZ)).toBe('National');
  });

  it('returns "National" when the zone is missing (defaults to HZ)', () => {
    expect(getZoneDisplayLabel(undefined)).toBe('National');
    expect(getZoneDisplayLabel(null)).toBe('National');
  });

  it('returns the zone unchanged for any other zone', () => {
    expect(getZoneDisplayLabel(ZoneName.IDF)).toBe(ZoneName.IDF);
    expect(getZoneDisplayLabel(ZoneName.AURA)).toBe(ZoneName.AURA);
  });
});
