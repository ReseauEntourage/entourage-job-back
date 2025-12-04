import { Injectable } from '@nestjs/common';
import { DepartmentsService } from 'src/common/departments/departments.service';
import { Departments } from 'src/common/locations/locations.types';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { SalesforceCampaignStatus } from 'src/external-services/salesforce/salesforce.types';
import { UsersService } from 'src/users/users.service';
import { Zones } from 'src/utils/constants/zones';
import {
  Event,
  EventMode,
  Events,
  EventType,
  EventWithParticipants,
} from './event.types';
import { convertSalesforceCampaignToEvent } from './events.utils';

@Injectable()
export class EventsService {
  constructor(
    private salesforceService: SalesforceService,
    private departmentsService: DepartmentsService,
    private usersService: UsersService
  ) {}

  /**
   * Find all events
   * @param limit Number of events to retrieve
   * @param offset Number of events to skip
   * @param search Search term to filter events
   * @returns List of events
   */
  async findAllEvents(
    userEmail: string,
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

    // Convert department names to Zones
    const zones = Departments.filter((dept) =>
      departmentNames.includes(dept.name)
    ).map((dept) => dept.zone);

    // Retrieve local branches from zones
    const localBranches = zones.flatMap((zone) => Zones[zone].sfLocalBranches);

    const sfCampaigns = await this.salesforceService.findAllEventCampaigns(
      userEmail,
      limit,
      offset,
      search,
      modes,
      eventTypes,
      localBranches
    );

    return sfCampaigns
      .map((campaign) => convertSalesforceCampaignToEvent(campaign))
      .filter((event) => event !== null) as Events;
  }

  /**
   * Find event by ID
   * @param userEmail email of the user making the request
   * @param eventId Salesforce Campaign ID of the event
   * @returns Event or null if not found
   */
  async findEventById(
    userEmail: string,
    eventId: string
  ): Promise<Event | null> {
    const sfCampaign = await this.salesforceService.findEventCampaignById(
      userEmail,
      eventId
    );
    if (!sfCampaign) {
      return null;
    }
    return convertSalesforceCampaignToEvent(sfCampaign);
  }

  /**
   * Find event with participants by ID
   * @param userEmail email of the user making the request
   * @param eventId Salesforce Campaign ID of the event
   * @returns Event with participants or null if not found
   */
  async findEventWithMembersById(
    userEmail: string,
    eventId: string
  ): Promise<EventWithParticipants | null> {
    const sfCampaign = await this.findEventById(userEmail, eventId);
    if (!sfCampaign) {
      return null;
    }
    // Retrieve SF Campaign Members for the given Campaign ID
    const members =
      await this.salesforceService.findAllCampaignMembersByCampaignId(
        eventId,
        SalesforceCampaignStatus.REGISTERED
      );

    // Extract emails from Campaign Members
    const membersEmails = members
      .filter((member) => member.Email)
      .map((member) => member.Email);

    // Retrieve Users from CampaignMembers where Email is defined
    const participantUsers = await this.usersService.findAllByMail(
      membersEmails
    );

    const participants = participantUsers.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      userProfile: {
        id: user.userProfile?.id,
        hasPicture: user.userProfile?.hasPicture,
      },
    }));

    // Return the event along with its participants
    return {
      ...sfCampaign,
      participants: participants,
    } as EventWithParticipants;
  }

  /**
   * Update event participation status for a user
   * @param userEmail email of the user making the request
   * @param eventId Salesforce Campaign ID of the event
   * @param isParticipating boolean indicating participation status
   */
  async updateEventParticipation(
    userEmail: string,
    eventId: string,
    isParticipating: boolean
  ): Promise<void> {
    const sfCampaign = await this.salesforceService.findEventCampaignById(
      userEmail,
      eventId
    );
    const sfContact = await this.salesforceService.findContact(userEmail);

    // Error handling if campaign or contact not found
    if (!sfCampaign) {
      console.error(
        `Event with ID ${eventId} not found in Salesforce, cannot update participation.`
      );
      throw new Error(`Event with ID ${eventId} not found in Salesforce`);
    }
    if (!sfContact) {
      console.error(
        `Contact with email ${userEmail} not found in Salesforce, cannot update event participation.`
      );
      throw new Error(
        `Contact with email ${userEmail} not found in Salesforce`
      );
    }

    // Update or create Campaign Member with the appropriate status
    try {
      await this.salesforceService.createOrUpdateCampaignMember(
        { contactId: sfContact.Id },
        sfCampaign.Id,
        isParticipating
          ? SalesforceCampaignStatus.REGISTERED
          : SalesforceCampaignStatus.CANCELED
      );
    } catch (error) {
      console.error(
        `Failed to update participation for contact ${sfContact.Id} in campaign ${sfCampaign.Id}:`,
        error
      );
      throw new Error('Failed to update event participation');
    }
  }
}
