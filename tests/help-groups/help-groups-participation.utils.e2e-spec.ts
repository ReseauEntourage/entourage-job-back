import { cleanHelpGroupTitle } from 'src/help-groups/help-groups-title.config';
import {
  findForbiddenExpression,
  parseForbiddenExpressions,
} from 'src/utils/misc/forbidden-expressions';

describe('Help groups - Participation utils', () => {
  describe('parseForbiddenExpressions', () => {
    it('Should split on commas and drop blank items', () => {
      expect(parseForbiddenExpressions(' whatsapp, ,virement ,')).toEqual([
        'whatsapp',
        'virement',
      ]);
      expect(parseForbiddenExpressions(undefined)).toEqual([]);
      expect(parseForbiddenExpressions('')).toEqual([]);
    });
  });

  describe('findForbiddenExpression', () => {
    const expressions = ['whatsapp', 'mot de passe', 'c++', 'arnaq'];

    it('Should match case insensitively and return the configured expression', () => {
      expect(findForbiddenExpression('Sur WhatsApp !', expressions)).toBe(
        'whatsapp'
      );
      expect(
        findForbiddenExpression('Donnez votre Mot De Passe', expressions)
      ).toBe('mot de passe');
    });

    it('Should only match on word boundaries, accented letters included', () => {
      expect(findForbiddenExpression('whatsapps', expressions)).toBeNull();
      expect(
        findForbiddenExpression('je suis arnaqué', expressions)
      ).toBeNull();
      expect(findForbiddenExpression('une arnaq.', expressions)).toBe('arnaq');
    });

    it('Should escape the special characters of an expression', () => {
      expect(findForbiddenExpression('du c++ ici', expressions)).toBe('c++');
      expect(findForbiddenExpression('du cc ici', expressions)).toBeNull();
    });

    it('Should return null for an empty list or text', () => {
      expect(findForbiddenExpression('whatsapp', [])).toBeNull();
      expect(findForbiddenExpression('', expressions)).toBeNull();
    });
  });

  describe('cleanHelpGroupTitle', () => {
    it('Should keep the first line without quotes', () => {
      expect(cleanHelpGroupTitle('« Comment faire ? »\nAutre')).toBe(
        'Comment faire ?'
      );
      expect(cleanHelpGroupTitle('\n  "Mon titre"  ')).toBe('Mon titre');
    });

    it('Should truncate to 120 characters', () => {
      expect(cleanHelpGroupTitle('a'.repeat(200))).toHaveLength(120);
    });

    it('Should return null for an empty output', () => {
      expect(cleanHelpGroupTitle(' \n " " ')).toBeNull();
      expect(cleanHelpGroupTitle('')).toBeNull();
    });
  });
});
