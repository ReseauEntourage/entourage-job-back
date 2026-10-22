import { Op } from 'sequelize';
import { getZoneDisplayLabel } from 'src/utils/constants/zones';
import {
  assertCondition,
  assertIsBoolean,
  assertIsDefined,
  assertIsNumber,
  assertIsString,
} from 'src/utils/misc/asserts';
import { getDepartmentLocative } from 'src/utils/misc/department-locative';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import {
  findForbiddenExpression,
  parseForbiddenExpressions,
} from 'src/utils/misc/forbidden-expressions';
import { getFiltersObjectsFromQueryParams } from 'src/utils/misc/getFiltersObjectsFromQueryParams';
import { getZoneNameFromDepartment } from 'src/utils/misc/getZoneFromDepartment';
import { isValidPhone } from 'src/utils/misc/isValidPhone';
import {
  escapeColumnRaw,
  escapeQuery,
  searchInColumnWhereOption,
  searchInColumnWhereOptionRaw,
} from 'src/utils/misc/searchInColumnWhereOption';
import { toArray } from 'src/utils/misc/toArray';
import { ZoneName } from 'src/utils/types/zones.types';

describe('asserts', () => {
  it('lets the right types through', () => {
    expect(() => assertIsString('a')).not.toThrow();
    expect(() => assertIsNumber(1)).not.toThrow();
    expect(() => assertIsBoolean(false)).not.toThrow();
    expect(() => assertIsDefined(0)).not.toThrow();
    expect(() => assertCondition(true)).not.toThrow();
  });

  it.each([
    ['assertIsString', () => assertIsString(1), 'string'],
    ['assertIsNumber', () => assertIsNumber('1'), 'number'],
    ['assertIsBoolean', () => assertIsBoolean('true'), 'boolean'],
    [
      'assertIsDefined (undefined)',
      () => assertIsDefined(undefined),
      'defined',
    ],
    ['assertIsDefined (null)', () => assertIsDefined(null), 'defined'],
    ['assertCondition', () => assertCondition(false), 'condition'],
  ])('%s throws an assertion error', (_name, call, type) => {
    expect(call).toThrow(`expected 'val' to be ${type}`);
  });

  it('appends the additional message to the error', () => {
    expect(() => assertIsString(1, 'while reading the config')).toThrow(
      'while reading the config'
    );
  });
});

describe('getDepartmentLocative', () => {
  it('returns the locative phrase of a known department', () => {
    expect(getDepartmentLocative('Ain (01)')).toBe("dans l'Ain");
  });

  it.each([null, '', 'Atlantis (99)'])(
    'falls back on "dans sa région" for %p',
    (department) => {
      expect(getDepartmentLocative(department)).toBe('dans sa région');
    }
  );
});

describe('findConstantFromValue', () => {
  const constants = [
    { label: 'One', value: 1 },
    { label: 'Two', value: 2 },
  ];

  it('finds the constant of a value', () => {
    expect(findConstantFromValue(2, constants)).toEqual({
      label: 'Two',
      value: 2,
    });
  });

  it('builds a constant from the value itself when it is unknown', () => {
    expect(findConstantFromValue(3, constants)).toEqual({
      label: '3',
      value: 3,
    });
  });
});

describe('forbidden expressions', () => {
  describe('parseForbiddenExpressions', () => {
    it('splits the list, trims the items and drops the blank ones', () => {
      expect(parseForbiddenExpressions(' foo , bar,, ,baz ')).toEqual([
        'foo',
        'bar',
        'baz',
      ]);
    });

    it.each([undefined, null, ''])('returns an empty list for %p', (raw) => {
      expect(parseForbiddenExpressions(raw)).toEqual([]);
    });
  });

  describe('findForbiddenExpression', () => {
    it('finds an expression whatever its case and returns it as configured', () => {
      expect(findForbiddenExpression('Un BON Plan ici', ['bon plan'])).toBe(
        'bon plan'
      );
    });

    it('only matches whole words, accented letters included', () => {
      expect(findForbiddenExpression('un reçu', ['re'])).toBeNull();
      expect(findForbiddenExpression('le caféine', ['café'])).toBeNull();
      expect(findForbiddenExpression('un café noir', ['café'])).toBe('café');
    });

    it('treats the expressions literally', () => {
      expect(findForbiddenExpression('a+b = c', ['a+b'])).toBe('a+b');
      expect(findForbiddenExpression('aab', ['a+b'])).toBeNull();
      expect(findForbiddenExpression('anything', ['.*'])).toBeNull();
    });

    it.each([
      ['', ['x']],
      ['some text', []],
    ])('returns null for text=%p and expressions=%p', (text, expressions) => {
      expect(findForbiddenExpression(text, expressions)).toBeNull();
    });
  });
});

describe('getFiltersObjectsFromQueryParams', () => {
  const filters = [
    {
      key: 'contract',
      title: 'Contract',
      constants: [
        { label: 'CDI', value: 'cdi' },
        { label: 'CDD', value: 'cdd' },
      ],
    },
    {
      key: 'level',
      title: 'Level',
      constants: [
        { label: 'One', value: 1 },
        { label: 'Two', value: 2 },
      ],
    },
  ] as never;

  it('maps the query values to the constants of the filters', () => {
    const result = getFiltersObjectsFromQueryParams(
      { contract: ['cdi', 'cdd'], level: '2' },
      filters
    );

    expect(result).toEqual({
      contract: [
        { label: 'CDI', value: 'cdi' },
        { label: 'CDD', value: 'cdd' },
      ],
      level: [{ label: 'Two', value: 2 }],
    });
  });

  it('ignores the unknown keys and the empty values', () => {
    const result = getFiltersObjectsFromQueryParams(
      { unknown: 'x', contract: [] } as never,
      filters
    );

    expect(result).toEqual({});
  });

  it('keeps an unknown value as undefined', () => {
    const result = getFiltersObjectsFromQueryParams(
      { contract: 'freelance' },
      filters
    );

    expect(result).toEqual({ contract: [undefined] });
  });

  it('returns no filter without filter definitions', () => {
    expect(
      getFiltersObjectsFromQueryParams({ contract: 'cdi' }, undefined)
    ).toEqual({});
  });
});

describe('isValidPhone', () => {
  it.each(['+33612345678', '+44 7911 123456'])('accepts %s', (value) => {
    expect(isValidPhone(value)).toBe(true);
  });

  it.each([
    ['an empty value', ''],
    ['a number without international prefix', '0612345678'],
    ['a number that is too short', '+33 6'],
    ['text', '+not a phone'],
  ])('rejects %s', (_label, value) => {
    expect(isValidPhone(value)).toBe(false);
  });

  it('rejects an undefined value', () => {
    expect(isValidPhone(undefined)).toBe(false);
  });
});

describe('search helpers', () => {
  it('normalizes a search query: case, accents, hyphens, quotes and spaces', () => {
    expect(escapeQuery("  L'Éléphant-Rose ")).toBe("l''elephant rose");
  });

  it('returns an empty string for an empty query', () => {
    expect(escapeQuery('')).toBe('');
    expect(escapeQuery(undefined)).toBe('');
  });

  it('builds the raw SQL normalization of a column', () => {
    expect(escapeColumnRaw('"User"."name"')).toBe(
      `replace(lower(unaccent("User"."name")), '-', ' ')`
    );
  });

  it('builds a raw like condition', () => {
    expect(searchInColumnWhereOptionRaw('u.name', 'Jean-Luc')).toBe(
      `replace(lower(unaccent(u.name)), '-', ' ') like '%jean luc%'`
    );
  });

  it('builds a case sensitive like condition by default and an iLike one on demand', () => {
    const sensitive = searchInColumnWhereOption('User.name', 'Éric') as {
      logic: Record<symbol, string>;
    };
    const insensitive = searchInColumnWhereOption(
      'User.name',
      'Éric',
      true
    ) as {
      logic: Record<symbol, string>;
    };

    expect(sensitive.logic[Op.like]).toBe('%eric%');
    expect(insensitive.logic[Op.iLike]).toBe('%eric%');
  });
});

describe('toArray', () => {
  it('keeps an array, wraps a single value and keeps undefined', () => {
    expect(toArray([1, 2])).toEqual([1, 2]);
    expect(toArray(1)).toEqual([1]);
    expect(toArray(undefined)).toBeUndefined();
  });
});

describe('zones', () => {
  it('knows the zone of a department, with a default for unknown ones', () => {
    expect(getZoneNameFromDepartment('Paris (75)')).toBe(ZoneName.IDF);
    expect(getZoneNameFromDepartment('Atlantis (99)' as never)).toBe(
      ZoneName.HZ
    );
  });

  it('displays the label of a zone', () => {
    expect(getZoneDisplayLabel(ZoneName.IDF)).toBe('PARIS');
    expect(getZoneDisplayLabel(ZoneName.HZ)).toBe('National');
    expect(getZoneDisplayLabel(null)).toBe('National');
  });
});
