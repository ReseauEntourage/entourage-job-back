import {
  normalizeCvDateRange,
  parseCvDate,
} from 'src/profile-generation/profile-generation.utils';

const utcDate = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day));

describe('parseCvDate', () => {
  it('keeps a full YYYY-MM-DD date', () => {
    expect(parseCvDate('2015-09-14')).toEqual(utcDate(2015, 9, 14));
  });

  it('normalizes a year only to January 1st', () => {
    expect(parseCvDate('2012')).toEqual(utcDate(2012, 1, 1));
  });

  it('normalizes a month and year to the 1st of the month', () => {
    expect(parseCvDate('2015-03')).toEqual(utcDate(2015, 3, 1));
  });

  it('trims surrounding whitespace', () => {
    expect(parseCvDate(' 2015-03-01 ')).toEqual(utcDate(2015, 3, 1));
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
    ['a blank string', '   '],
    ['a label', 'présent'],
    ['a natural language date', 'mars 2015'],
    ['a French formatted date', '14/09/2015'],
    ['an impossible day', '2015-02-30'],
    ['an impossible month', '2015-13'],
    ['a zero month', '2015-00-10'],
    ['a number', 2015],
  ])('returns null for %s', (_label, value) => {
    expect(parseCvDate(value)).toBeNull();
  });
});

describe('normalizeCvDateRange', () => {
  it('returns no date at all when none is provided', () => {
    expect(normalizeCvDateRange({})).toEqual({
      startDate: null,
      endDate: null,
    });
  });

  it('keeps an empty end date for an ongoing item', () => {
    expect(normalizeCvDateRange({ startDate: '2023-01-01' })).toEqual({
      startDate: utcDate(2023, 1, 1),
      endDate: null,
    });
  });

  it('keeps an end date alone', () => {
    expect(normalizeCvDateRange({ endDate: '2012' })).toEqual({
      startDate: null,
      endDate: utcDate(2012, 1, 1),
    });
  });

  it('keeps both dates when consistent', () => {
    expect(
      normalizeCvDateRange({ startDate: '2015-09', endDate: '2018-06' })
    ).toEqual({
      startDate: utcDate(2015, 9, 1),
      endDate: utcDate(2018, 6, 1),
    });
  });

  it('drops the start date when it is after the end date', () => {
    expect(
      normalizeCvDateRange({ startDate: '2018', endDate: '2015' })
    ).toEqual({ startDate: null, endDate: utcDate(2015, 1, 1) });
  });

  it('treats each date independently when one is invalid', () => {
    expect(
      normalizeCvDateRange({ startDate: 'présent', endDate: '2015' })
    ).toEqual({ startDate: null, endDate: utcDate(2015, 1, 1) });
  });

  it('never falls back to 1970 for a null date', () => {
    expect(normalizeCvDateRange({ startDate: null, endDate: null })).toEqual({
      startDate: null,
      endDate: null,
    });
  });
});
