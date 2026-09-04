import { EventType } from './event.types';
import { convertSalesforceCampaignToEvent } from './events.utils';

describe('convertSalesforceCampaignToEvent', () => {
  it('maps the "Evenement de convivialité" Salesforce type to EventType.FRIENDLINESS', () => {
    const event = convertSalesforceCampaignToEvent({
      Id: 'a001',
      Name: 'Café convivial',
      Description: 'Un temps convivial entre candidats et coachs.',
      Type_evenement__c: 'Evenement de convivialité',
    });

    expect(event).not.toBeNull();
    expect(event?.eventType).toBe(EventType.FRIENDLINESS);
    expect(event?.goal).toBeUndefined();
    expect(event?.audience).toBeUndefined();
    expect(event?.format).toBeUndefined();
    expect(event?.sequences).toEqual([]);
  });

  it('still drops unrecognized Salesforce types as before', () => {
    const event = convertSalesforceCampaignToEvent({
      Id: 'a002',
      Type_evenement__c: 'Some unknown Salesforce type',
    });

    expect(event).toBeNull();
  });
});
