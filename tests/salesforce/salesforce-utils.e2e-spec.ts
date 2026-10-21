import {
  CandidateAccommodations,
  CandidateGenders,
  CandidateResources,
  CompanyApproaches,
  HeardAbout,
  JobSearchDurations,
  Nationalities,
  StudiesLevels,
  YesNoJNSPR,
} from 'src/contacts/contacts.types';
import {
  Casquette,
  ContactRecordTypesIds,
  LeadRecordTypesIds,
} from 'src/external-services/salesforce/salesforce.types';
import {
  addToSalesforceMultiPicklist,
  classifySalesforceAppIdBackfillCandidates,
  determineContactRecordType,
  escapeQuery,
  formatBusinessSectors,
  formatCompanyName,
  formatDepartment,
  formatRegions,
  formatSalesforceValue,
  getCasquette,
  getPostalCodeFromDepartment,
  mapSalesforceContactFields,
  mapSalesforceContactSocialSituationFields,
  mapSalesforceLeadFields,
  parseAddress,
  parseSalesforceMultiPicklist,
  prependDuplicateIfCondition,
} from 'src/external-services/salesforce/salesforce.utils';
import { UserRoles } from 'src/users/users.types';

describe('salesforce.utils', () => {
  describe('formatting helpers', () => {
    it('formatBusinessSectors joins unique labels, undefined without sectors', () => {
      expect(formatBusinessSectors(undefined)).toBeUndefined();
      expect(
        formatBusinessSectors([
          { name: 'bat' },
          { name: 'bat' },
          { name: 'la' },
        ] as never)
      ).toBe('Bâtiment;Logistique et approvisionnement');
    });

    it('formatDepartment maps a department to its local branch, National otherwise', () => {
      expect(formatDepartment(undefined)).toBe('National');
      expect(formatDepartment('Paris (75)' as never)).toEqual(
        expect.any(String)
      );
      expect(formatDepartment('Paris (75)' as never)).not.toBe('National');
    });

    it('formatRegions capitalizes', () => {
      expect(formatRegions('PARIS' as never)).toBe('Paris');
    });

    it('formatSalesforceValue handles single, array and empty values', () => {
      const constants = { a: 'A', b: 'B' };
      expect(formatSalesforceValue('a', constants)).toBe('A');
      expect(formatSalesforceValue(['a', 'b'], constants)).toBe('A;B');
      expect(formatSalesforceValue(undefined, constants)).toBeUndefined();
    });

    it('formatCompanyName falls back to Inconnu', () => {
      expect(formatCompanyName('Acme', 'Paris (75)' as never, '1 rue X')).toBe(
        'Acme - 1 rue X - Paris (75)'
      );
      expect(formatCompanyName('', undefined)).toBe(
        'Inconnu - Inconnu - Inconnu'
      );
    });

    it('getPostalCodeFromDepartment pads the department digits', () => {
      expect(getPostalCodeFromDepartment('Paris (75)' as never)).toBe('75000');
      expect(getPostalCodeFromDepartment('Ain' as never)).toBe('00000');
    });

    it('escapeQuery escapes quotes and tolerates empty values', () => {
      expect(escapeQuery("l'été")).toBe("l\\'été");
      expect(escapeQuery('')).toBe('');
      expect(escapeQuery(undefined)).toBeUndefined();
    });

    it('prependDuplicateIfCondition only prefixes when asked', () => {
      expect(prependDuplicateIfCondition('a@b.c', true)).toBe('bis_a@b.c');
      expect(prependDuplicateIfCondition('a@b.c', false)).toBe('a@b.c');
    });

    it('multi-picklist helpers parse and add without duplicating', () => {
      expect(parseSalesforceMultiPicklist(undefined)).toEqual([]);
      expect(parseSalesforceMultiPicklist('a;b')).toEqual(['a', 'b']);
      expect(addToSalesforceMultiPicklist(['a'], 'a')).toEqual(['a']);
      expect(addToSalesforceMultiPicklist(['a'], 'b')).toEqual(['a', 'b']);
    });
  });

  describe('parseAddress', () => {
    it('returns empty fields without address', () => {
      expect(parseAddress('')).toEqual({
        street: '',
        city: '',
        postalCode: '',
      });
    });

    it('splits street, postal code and city', () => {
      expect(parseAddress('3 rue des Lilas, 75010 Paris')).toEqual({
        street: '3 rue des Lilas',
        city: 'Paris',
        postalCode: '75010',
      });
    });

    it('splits on the comma when there is a street number but no postal code', () => {
      expect(parseAddress('12, rue X, Lyon')).toEqual({
        street: '12 rue X',
        city: 'Lyon',
      });
    });

    it('keeps the whole address as street otherwise', () => {
      expect(parseAddress('Rue sans numero')).toEqual({
        street: 'Rue sans numero',
      });
    });
  });

  describe('roles', () => {
    it('determineContactRecordType per role', () => {
      expect(determineContactRecordType(UserRoles.CANDIDATE, false)).toBe(
        ContactRecordTypesIds.PRECARIOUS
      );
      expect(determineContactRecordType(UserRoles.COACH, true)).toBe(
        ContactRecordTypesIds.COMPANY
      );
      expect(determineContactRecordType(UserRoles.COACH, false)).toBe(
        ContactRecordTypesIds.NEIGHBOR
      );
      expect(determineContactRecordType(UserRoles.REFERER, false)).toBe(
        ContactRecordTypesIds.ASSOCIATION
      );
      expect(() =>
        determineContactRecordType(UserRoles.ADMIN as never, false)
      ).toThrow('Invalid RegistrableUserRole');
    });

    it('getCasquette per role', () => {
      expect(getCasquette(UserRoles.CANDIDATE)).toBe(
        Casquette.CANDIDAT_COUP_DE_POUCE
      );
      expect(getCasquette(UserRoles.COACH)).toBe(Casquette.COACH_COUP_DE_POUCE);
      expect(getCasquette(UserRoles.REFERER)).toBe(Casquette.PRESCRIPTEUR);
    });
  });

  describe('mapSalesforceLeadFields', () => {
    const common = {
      firstName: 'Jo',
      lastName: 'Doe',
      email: 'jo@example.com',
      phone: '0600000000',
      zone: 'PARIS',
    };

    it('maps a company lead', () => {
      const lead = mapSalesforceLeadFields(
        {
          ...common,
          company: 'Acme',
          position: 'CEO',
          approach: CompanyApproaches.RECRUITMENT,
          heardAbout: HeardAbout.LINKEDIN,
          newsletter: true,
          message: 'hello',
        } as never,
        LeadRecordTypesIds.COMPANY
      ) as unknown as Record<string, unknown>;

      expect(lead).toMatchObject({
        Company: 'Acme',
        Title: 'CEO',
        Message_For__c: 'hello',
        Abonnements_Plezi__c: true,
        Reseaux__c: 'LinkedOut',
        Antenne__c: 'Paris',
      });
      expect(lead.Votre_demarche__c).toEqual(expect.any(String));
      expect(lead.Comment_vous_nous_avez_connu__c).toEqual(expect.any(String));
    });

    it('maps an association lead', () => {
      const lead = mapSalesforceLeadFields(
        {
          ...common,
          company: 'Asso',
          position: 'Dir',
          heardAbout: HeardAbout.PRESS,
          contactWithCoach: true,
        } as never,
        LeadRecordTypesIds.ASSOCIATION
      ) as unknown as Record<string, unknown>;

      expect(lead).toMatchObject({
        Company: 'Asso',
        TS_Mettre_en_relation_Coach__c: true,
      });
    });

    it('maps a coach lead with the default company', () => {
      const lead = mapSalesforceLeadFields(
        { ...common, position: 'Dev' } as never,
        LeadRecordTypesIds.COACH
      ) as unknown as Record<string, unknown>;

      expect(lead.Company).toBe('Coachs Entourage Pro');
      expect(lead.Title).toBe('Dev');
    });

    it('maps a candidate lead and truncates long values', () => {
      const lead = mapSalesforceLeadFields(
        {
          ...common,
          lastName: 'L'.repeat(100),
          phone: '0'.repeat(50),
          email: 'élodie@example.com',
          gender: CandidateGenders.FEMALE,
          birthDate: new Date('1990-01-01'),
          address: `3 rue X, 75010 ${'V'.repeat(50)}`,
          accommodation: CandidateAccommodations.PERSONAL,
          resources: [CandidateResources.RSA],
          nationality: Nationalities.FRENCH,
          hasSocialWorker: YesNoJNSPR.YES,
          studiesLevel: StudiesLevels.BAC,
          jobSearchDuration: JobSearchDurations.LESS_THAN_3_MONTHS,
          heardAbout: HeardAbout.OTHER,
          description: 'desc',
          diagnostic: 'diag',
          autreSource: 'src',
        } as never,
        LeadRecordTypesIds.CANDIDATE
      ) as unknown as Record<string, unknown>;

      expect(lead.LastName).toHaveLength(80);
      expect(lead.Phone).toHaveLength(40);
      expect(lead.Email).toBe('elodie@example.com');
      expect(lead.City).toHaveLength(40);
      expect(lead.PostalCode).toBe('75010');
      expect(lead.Genre__c).toBe('Femme');
      expect(lead.Company).toBe('Candidats Entourage Pro');
      expect(lead.Message_For__c).toBe('desc');
    });

    it('defaults the last name to Inconnu and returns undefined for an unknown record type', () => {
      const lead = mapSalesforceLeadFields(
        { ...common, lastName: undefined } as never,
        LeadRecordTypesIds.COACH
      ) as unknown as Record<string, unknown>;
      expect(lead.LastName).toBe('Inconnu');
      expect(
        mapSalesforceLeadFields(common as never, 'unknown')
      ).toBeUndefined();
    });
  });

  describe('contact mapping', () => {
    it('maps social situation fields', () => {
      const fields = mapSalesforceContactSocialSituationFields({
        nationality: Nationalities.FRENCH,
        accommodation: CandidateAccommodations.PERSONAL,
        hasSocialWorker: YesNoJNSPR.NO,
        resources: [CandidateResources.RSA],
        studiesLevel: StudiesLevels.BAC,
      } as never);

      expect(fields.Accompagnement_social_O_N__c).toBe('Non');
      expect(fields.Nationalit__c).toEqual(expect.any(String));
      expect(fields.Dur_e_de_recherche_d_emploi__c).toBeUndefined();
    });

    it('maps a full contact and truncates', () => {
      const fields = mapSalesforceContactFields(
        {
          id: 'user-1',
          firstName: 'Jo',
          lastName: 'L'.repeat(100),
          email: 'élodie@example.com',
          phone: '0'.repeat(50),
          position: 'Dev',
          department: 'Paris (75)',
          accountSfId: 'acc',
          casquettes: [Casquette.COACH_COUP_DE_POUCE, Casquette.PRESCRIPTEUR],
          birthDate: new Date('1990-01-01'),
          gender: CandidateGenders.MALE,
          refererId: 'ref',
          companyName: 'Acme',
          reseaux: ['LinkedOut', 'Local'],
        } as never,
        ContactRecordTypesIds.NEIGHBOR
      );

      expect(fields.LastName).toHaveLength(80);
      expect(fields.Email).toBe('elodie@example.com');
      expect(fields.Phone).toHaveLength(40);
      expect(fields.Casquettes_r_les__c).toBe(
        `${Casquette.COACH_COUP_DE_POUCE};${Casquette.PRESCRIPTEUR}`
      );
      expect(fields.Reseaux__c).toBe('LinkedOut;Local');
      expect(fields.MailingPostalCode).toBe('75000');
      expect(fields.Genre__c).toBe('Homme');
      expect(fields.TS_prescripteur__c).toBe('ref');
      expect(fields.Raison_social_Entreprise__c).toBe('Acme');
    });

    it('maps a sparse contact to undefined fields with defaults', () => {
      const fields = mapSalesforceContactFields(
        { casquettes: [] } as never,
        undefined
      );

      expect(fields.LastName).toBeUndefined();
      expect(fields.Email).toBeUndefined();
      expect(fields.Casquettes_r_les__c).toBeUndefined();
      expect(fields.Reseaux__c).toBe('LinkedOut');
      expect(fields.Raison_social_Entreprise__c).toBeNull();
      expect(fields.Genre__c).toBeUndefined();
    });
  });

  describe('classifySalesforceAppIdBackfillCandidates', () => {
    it.each([
      ['not_found', [], undefined],
      ['ambiguous', [{ Id: '1', ID_App_Entourage_Pro__c: 'other' }], undefined],
      [
        'already_linked',
        [{ Id: '1', ID_App_Entourage_Pro__c: 'me' }],
        undefined,
      ],
      ['safe_correction', [{ Id: '1' }], '1'],
      ['ambiguous', [{ Id: '1' }, { Id: '2' }], undefined],
    ])('classifies as %s', (category, candidates, toRepair) => {
      const result = classifySalesforceAppIdBackfillCandidates(
        candidates as never,
        'me'
      );
      expect(result.category).toBe(category);
      if (toRepair) {
        expect(result).toEqual({
          category: 'safe_correction',
          contactIdToRepair: toRepair,
        });
      }
    });
  });
});
