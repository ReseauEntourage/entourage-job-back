import { Injectable } from '@nestjs/common';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { EventMode, Events, EventType } from './event.types';
import { convertSalesforceCampaignToEvent } from './events.utils';

@Injectable()
export class EventsService {
  constructor(private salesforceService: SalesforceService) {}

  /**
   * Find all events
   * @param limit Number of events to retrieve
   * @param offset Number of events to skip
   * @param search Search term to filter events
   * @returns List of events
   */
  async findAllEvents(
    limit: number,
    offset: number,
    search = '',
    mode?: EventMode,
    eventType?: EventType,
    departmentId?: string
  ): Promise<Events> {
    const sfCampaigns = await this.salesforceService.findAllEventCompaigns(
      limit,
      offset,
      search,
      mode,
      eventType,
      departmentId
    );
    return sfCampaigns.map((campaign) =>
      convertSalesforceCampaignToEvent(campaign)
    );
  }
}
