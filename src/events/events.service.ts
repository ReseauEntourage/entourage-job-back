import { Injectable } from '@nestjs/common';
import { DepartmentsService } from 'src/common/departments/departments.service';
import { Departments } from 'src/common/locations/locations.types';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { LOCAL_BRANCHES_ZONES } from 'src/utils/types';
import { Event, EventMode, Events, EventType } from './event.types';
import { convertSalesforceCampaignToEvent } from './events.utils';

@Injectable()
export class EventsService {
  constructor(
    private salesforceService: SalesforceService,
    private departmentsService: DepartmentsService
  ) {}

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
    modes?: EventMode[],
    eventTypes?: EventType[],
    departmentIds?: string[]
  ): Promise<Events> {
    const departmentNames =
      await this.departmentsService.mapDepartmentsIdsToFormattedNames(
        departmentIds || []
      );

    // Convert department names to AdminZones
    const zones = Departments.filter((dept) =>
      departmentNames.includes(dept.name)
    ).map((dept) => dept.zone);

    // Convert zones to local branches
    const localBranches = zones.flatMap((zone) => LOCAL_BRANCHES_ZONES[zone]);

    const sfCampaigns = await this.salesforceService.findAllEventCampaigns(
      limit,
      offset,
      search,
      modes,
      eventTypes,
      localBranches
    );
    return sfCampaigns.map((campaign) =>
      convertSalesforceCampaignToEvent(campaign)
    );
  }

  async findEventById(eventId: string): Promise<Event | null> {
    const sfCampaign = await this.salesforceService.findEventCampaignById(
      eventId
    );
    if (!sfCampaign) {
      return null;
    }
    return convertSalesforceCampaignToEvent(sfCampaign);
  }
}
