import { ContactRecordTypesIds } from 'src/external-services/salesforce/salesforce.types';
import { mapSalesforceContactFields } from 'src/external-services/salesforce/salesforce.utils';

describe('mapSalesforceContactFields - Reseaux__c', () => {
  it('defaults Reseaux__c to LinkedOut when reseaux is not provided (contact creation)', () => {
    const record = mapSalesforceContactFields(
      { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
      ContactRecordTypesIds.PRECARIOUS
    );

    expect(record.Reseaux__c).toBe('LinkedOut');
  });

  it('writes the merged reseaux value instead of overwriting it, when reseaux is provided (contact update)', () => {
    const record = mapSalesforceContactFields(
      {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        reseaux: ['Entourage Local', 'LinkedOut'],
      },
      ContactRecordTypesIds.PRECARIOUS
    );

    expect(record.Reseaux__c).toBe('Entourage Local;LinkedOut');
  });
});
