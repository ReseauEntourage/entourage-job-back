import { classifySalesforceAppIdBackfillCandidates } from 'src/external-services/salesforce/salesforce.utils';

describe('classifySalesforceAppIdBackfillCandidates', () => {
  const appId = 'user-1';

  it('classifies as not_found when there is no candidate', () => {
    expect(classifySalesforceAppIdBackfillCandidates([], appId)).toEqual({
      category: 'not_found',
    });
  });

  it('classifies as safe_correction for a single candidate with an empty id', () => {
    const candidates = [{ Id: 'contact-1' }];

    expect(
      classifySalesforceAppIdBackfillCandidates(candidates, appId)
    ).toEqual({
      category: 'safe_correction',
      contactIdToRepair: 'contact-1',
    });
  });

  it('classifies as already_linked when every candidate is already linked to this user', () => {
    const candidates = [
      { Id: 'contact-1', ID_App_Entourage_Pro__c: appId },
      { Id: 'contact-2', ID_App_Entourage_Pro__c: appId },
    ];

    expect(
      classifySalesforceAppIdBackfillCandidates(candidates, appId)
    ).toEqual({
      category: 'already_linked',
    });
  });

  it('classifies as ambiguous when a candidate is linked to a different user', () => {
    const candidates = [
      { Id: 'contact-1', ID_App_Entourage_Pro__c: 'other-user' },
    ];

    expect(
      classifySalesforceAppIdBackfillCandidates(candidates, appId)
    ).toEqual({
      category: 'ambiguous',
    });
  });

  it('classifies as ambiguous when multiple empty candidates exist with no way to pick one', () => {
    const candidates = [{ Id: 'contact-1' }, { Id: 'contact-2' }];

    expect(
      classifySalesforceAppIdBackfillCandidates(candidates, appId)
    ).toEqual({
      category: 'ambiguous',
    });
  });
});
