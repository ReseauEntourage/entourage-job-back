// events.utils relies on moment-timezone having been loaded by another module
import 'moment-timezone';

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

  describe('awareness workshop (EN-9855)', () => {
    const baseCampaign = {
      Id: 'a003',
      Name: '👌 Sensibilisation Isolement & Précarité',
      Type_evenement__c: 'Atelier de sensib Monde de la rue',
      Impact__c: 'Sensibilisation',
      StartDate: '2027-01-20',
      Heure_de_d_but__c: '10:00:00.000Z',
      EndDate: '2027-01-20',
      Heure_de_fin__c: '11:00:00.000Z',
      MeetingLink__c: 'https://meet.example.com/abc',
    };

    it('recognizes a campaign meeting all three criteria as AWARENESS_WORKSHOP', () => {
      const event = convertSalesforceCampaignToEvent(baseCampaign);

      expect(event).not.toBeNull();
      expect(event?.eventType).toBe(EventType.AWARENESS_WORKSHOP);
      expect(event?.goal).toContain('déconstruire les préjugés');
      expect(event?.audience).toBe('Coachs et candidats de toute la France');
      expect(event?.format).toBe('Webinaire - En ligne');
      expect(event?.sequences).toHaveLength(4);
    });

    it('drops a campaign with the right action type but the wrong impact', () => {
      const event = convertSalesforceCampaignToEvent({
        ...baseCampaign,
        Impact__c: 'Autre chose',
      });

      expect(event).toBeNull();
    });

    it('drops a campaign with the right impact but without the network already filtered upstream', () => {
      const event = convertSalesforceCampaignToEvent({
        ...baseCampaign,
        Type_evenement__c: 'Some other action type',
      });

      expect(event).toBeNull();
    });

    it('hides a session without a connection link', () => {
      const event = convertSalesforceCampaignToEvent({
        ...baseCampaign,
        MeetingLink__c: undefined,
      });

      expect(event).toBeNull();
    });

    it('hides a session without a start date', () => {
      const event = convertSalesforceCampaignToEvent({
        ...baseCampaign,
        StartDate: undefined,
      });

      expect(event).toBeNull();
    });

    it('leaves other recognized event types unchanged', () => {
      const event = convertSalesforceCampaignToEvent({
        Id: 'a004',
        Name: 'Atelier réseau',
        Type_evenement__c: 'Atelier Réseau',
      });

      expect(event).not.toBeNull();
      expect(event?.eventType).toBe(EventType.NETWORKING);
    });
  });
});
