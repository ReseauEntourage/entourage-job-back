import { NotFoundException, ValidationPipe } from '@nestjs/common';
// events.utils relies on moment-timezone having been loaded by another module
import 'moment-timezone';
import { EventParticipationDto } from 'src/events/dto/event-participation.dto';
import { FindAllEventsQueryDto } from 'src/events/dto/find-all-events-query.dto';
import {
  EventMode,
  EventPublicAudience,
  EventType,
  SalesforceEventTypes,
} from 'src/events/event.types';
import { EventsController } from 'src/events/events.controller';
import { EventsService } from 'src/events/events.service';
import {
  computeEventDurationFromSalesforceCampaign,
  computeModeFromSalesforceCampaign,
  convertSalesforceCampaignToEvent,
} from 'src/events/events.utils';
import { SalesforceCampaignStatus } from 'src/external-services/salesforce/salesforce.types';
import { SfLocalBranchName } from 'src/utils/types/local-branches.types';

const campaign = (overrides: Record<string, unknown> = {}) => ({
  Id: 'campaign-1',
  Name: 'Atelier réseau',
  Description: 'Description',
  Type_evenement__c: SalesforceEventTypes.NETWORKING,
  StartDate: '2030-03-10',
  Heure_de_d_but__c: '18:00:00.000Z',
  EndDate: '2030-03-10',
  Heure_de_fin__c: '19:30:00.000Z',
  En_ligne__c: 'Non',
  ...overrides,
});

describe('events utils', () => {
  describe('computeModeFromSalesforceCampaign', () => {
    it.each([
      ['Oui', EventMode.ONLINE],
      ['Non', EventMode.IRL],
      [undefined, EventMode.IRL],
    ])('maps En_ligne__c=%s to %s', (value, mode) => {
      expect(
        computeModeFromSalesforceCampaign(
          campaign({ En_ligne__c: value }) as never
        )
      ).toBe(mode);
    });
  });

  describe('computeEventDurationFromSalesforceCampaign', () => {
    it('returns the duration in minutes', () => {
      expect(
        computeEventDurationFromSalesforceCampaign(campaign() as never)
      ).toBe(90);
    });

    it('supports an event spanning several days', () => {
      expect(
        computeEventDurationFromSalesforceCampaign(
          campaign({ EndDate: '2030-03-11' }) as never
        )
      ).toBe(90 + 24 * 60);
    });

    it.each(['StartDate', 'Heure_de_d_but__c', 'EndDate', 'Heure_de_fin__c'])(
      'returns null when %s is missing',
      (field) => {
        expect(
          computeEventDurationFromSalesforceCampaign(
            campaign({ [field]: undefined }) as never
          )
        ).toBeNull();
      }
    );
  });

  describe('convertSalesforceCampaignToEvent', () => {
    it('converts the dates from Paris time and exposes the type specific texts', () => {
      const event = convertSalesforceCampaignToEvent(campaign() as never);

      // The "Z" suffix of Salesforce is misleading: times are Paris times (CET in March)
      expect(event.startDate).toBe('2030-03-10T18:00:00+01:00');
      expect(event.endDate).toBe('2030-03-10T19:30:00+01:00');
      expect(event).toEqual(
        expect.objectContaining({
          salesForceId: 'campaign-1',
          name: 'Atelier réseau',
          eventType: EventType.NETWORKING,
          mode: EventMode.IRL,
          duration: 90,
          isParticipating: false,
          participantsCount: 0,
          registrationCount: 0,
          meetingLink: null,
          fullAddress: null,
          publicSensibilise: null,
        })
      );
      expect(event.goal).toContain('réseau');
      expect(event.sequences.length).toBeGreaterThan(0);
    });

    it('applies the summer time offset in summer', () => {
      const event = convertSalesforceCampaignToEvent(
        campaign({ StartDate: '2030-07-10', EndDate: '2030-07-10' }) as never
      );

      expect(event.startDate).toBe('2030-07-10T18:00:00+02:00');
    });

    it('leaves the dates null when the time is missing', () => {
      const event = convertSalesforceCampaignToEvent(
        campaign({
          Heure_de_d_but__c: undefined,
          Heure_de_fin__c: null,
        }) as never
      );

      expect(event.startDate).toBeNull();
      expect(event.endDate).toBeNull();
      expect(event.duration).toBeNull();
    });

    it('flags the event as participated when the member list is not empty', () => {
      const event = convertSalesforceCampaignToEvent(
        campaign({ CampaignMembers: { records: [{ Id: 'm1' }] } }) as never
      );

      expect(event.isParticipating).toBe(true);
    });

    it('exposes the counts, the meeting link and the address', () => {
      const event = convertSalesforceCampaignToEvent(
        campaign({
          Nombre_de_participants__c: 12,
          Nombre_d_inscrits__c: 20,
          MeetingLink__c: 'https://meet.example.org',
          Adresse_de_l_v_nement__c: '1 rue de Paris',
          En_ligne__c: 'Oui',
        }) as never
      );

      expect(event).toEqual(
        expect.objectContaining({
          participantsCount: 12,
          registrationCount: 20,
          meetingLink: 'https://meet.example.org',
          fullAddress: '1 rue de Paris',
          mode: EventMode.ONLINE,
        })
      );
    });

    it('splits the audiences of the event', () => {
      const event = convertSalesforceCampaignToEvent(
        campaign({ Public_sensibilis__c: 'Jeunes; Entreprises' }) as never
      );

      expect(event.publicSensibilise).toEqual([
        EventPublicAudience.YOUNG_PUBLIC,
        EventPublicAudience.COMPANIES,
      ]);
    });

    it.each([
      ['Oui', 'En ligne'],
      ['Non', 'En présentiel'],
    ])(
      'derives the format of a workshop from En_ligne__c=%s',
      (online, format) => {
        const event = convertSalesforceCampaignToEvent(
          campaign({
            Type_evenement__c: SalesforceEventTypes.WORKSHOP,
            En_ligne__c: online,
          }) as never
        );

        expect(event.format).toBe(format);
      }
    );

    it.each(Object.values(SalesforceEventTypes))(
      'recognizes the "%s" type',
      (type) => {
        const event = convertSalesforceCampaignToEvent(
          campaign({ Type_evenement__c: type }) as never
        );

        expect(event.eventType).not.toBe(EventType.UNKNOWN);
      }
    );
  });
});

describe('FindAllEventsQueryDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const parse = (query: Record<string, unknown>) =>
    pipe.transform(query, {
      type: 'query',
      metatype: FindAllEventsQueryDto,
    }) as Promise<FindAllEventsQueryDto>;

  it('applies the defaults', async () => {
    const dto = await parse({});

    expect(dto.limit).toBe(50);
    expect(dto.offset).toBe(0);
    expect(dto.includePastEvents).toBe(false);
  });

  it('converts the numbers and wraps single values into arrays', async () => {
    const dto = await parse({
      limit: '10',
      offset: '5',
      modes: 'online',
      eventTypes: ['NETWORKING', 'WORKSHOP'],
    });

    expect(dto.limit).toBe(10);
    expect(dto.offset).toBe(5);
    expect(dto.modes).toEqual(['online']);
    expect(dto.eventTypes).toEqual(['NETWORKING', 'WORKSHOP']);
  });

  it.each([
    ['a limit above 200', { limit: '201' }],
    ['a limit below 1', { limit: '0' }],
    ['a negative offset', { offset: '-1' }],
    ['an unknown mode', { modes: 'teleport' }],
    ['an unknown event type', { eventTypes: 'PARTY' }],
    ['a department that is not a uuid', { departmentIds: 'abc' }],
    ['an invalid participation filter', { isParticipating: 'maybe' }],
    ['an unknown audience', { publicSensibilise: 'Martiens' }],
    ['a too long search', { search: 'a'.repeat(201) }],
  ])('rejects %s', async (_label, query) => {
    await expect(parse(query)).rejects.toThrow();
  });
});

describe('EventsService', () => {
  const build = () => {
    const salesforceService = {
      findAllEventCampaigns: jest.fn().mockResolvedValue([]),
      findEventCampaignById: jest.fn(),
      findAllCampaignMembersByCampaignId: jest.fn().mockResolvedValue([]),
      findContact: jest.fn(),
      createOrUpdateCampaignMember: jest.fn().mockResolvedValue(undefined),
    };
    const departmentsService = {
      mapDepartmentsIdsToFormattedNames: jest.fn().mockResolvedValue([]),
    };
    const usersService = { findAllByMail: jest.fn().mockResolvedValue([]) };
    const service = new EventsService(
      salesforceService as never,
      departmentsService as never,
      usersService as never
    );
    return { service, salesforceService, departmentsService, usersService };
  };

  describe('findAllEvents', () => {
    it('converts the campaigns into events and drops the unknown types', async () => {
      const { service, salesforceService } = build();
      salesforceService.findAllEventCampaigns.mockResolvedValue([
        campaign({ Id: 'a' }),
        campaign({ Id: 'b', Type_evenement__c: 'Unknown type' }),
      ]);

      const events = await service.findAllEvents(
        'user@example.org',
        10,
        0,
        false,
        null
      );

      expect(events.map((e) => e.salesForceId)).toEqual(['a']);
    });

    it('turns the departments into the local branches of their zone, plus the national one', async () => {
      const { service, salesforceService, departmentsService } = build();
      departmentsService.mapDepartmentsIdsToFormattedNames.mockResolvedValue([
        'Paris (75)',
      ]);

      await service.findAllEvents(
        'user@example.org',
        10,
        5,
        true,
        true,
        'cafe',
        [EventMode.IRL],
        [EventType.NETWORKING],
        ['dept-id'],
        [EventPublicAudience.COMPANIES],
        'user-1'
      );

      const args = salesforceService.findAllEventCampaigns.mock.calls[0];
      expect(args.slice(0, 7)).toEqual([
        'user@example.org',
        10,
        5,
        true,
        true,
        'cafe',
        [EventMode.IRL],
      ]);
      expect(args[8]).toContain(SfLocalBranchName.NATIONAL);
      expect(args[8].length).toBeGreaterThan(1);
      expect(args[10]).toBe('user-1');
    });

    it('does not filter on any local branch without department', async () => {
      const { service, salesforceService } = build();

      await service.findAllEvents('user@example.org', 10, 0, false, null);

      expect(salesforceService.findAllEventCampaigns.mock.calls[0][8]).toEqual(
        []
      );
    });
  });

  describe('findEventById', () => {
    it('returns null when Salesforce knows no such campaign', async () => {
      const { service, salesforceService } = build();
      salesforceService.findEventCampaignById.mockResolvedValue(null);

      await expect(
        service.findEventById('user@example.org', 'x')
      ).resolves.toBeNull();
    });

    it('returns the converted event', async () => {
      const { service, salesforceService } = build();
      salesforceService.findEventCampaignById.mockResolvedValue(campaign());

      const event = await service.findEventById('user@example.org', 'x', 'u1');

      expect(event.salesForceId).toBe('campaign-1');
      expect(salesforceService.findEventCampaignById).toHaveBeenCalledWith(
        'user@example.org',
        'x',
        'u1'
      );
    });
  });

  describe('findEventWithMembersById', () => {
    it('returns null when the event does not exist', async () => {
      const { service, salesforceService } = build();
      salesforceService.findEventCampaignById.mockResolvedValue(null);

      await expect(
        service.findEventWithMembersById('user@example.org', 'x')
      ).resolves.toBeNull();
    });

    it('adds the participants who have an account, found by email', async () => {
      const { service, salesforceService, usersService } = build();
      salesforceService.findEventCampaignById.mockResolvedValue(campaign());
      salesforceService.findAllCampaignMembersByCampaignId.mockResolvedValue([
        { Email: 'a@example.org' },
        { Email: null },
        { Email: 'b@example.org' },
      ]);
      usersService.findAllByMail.mockResolvedValue([
        {
          id: 'u1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          role: 'Coach',
          userProfile: { id: 'p1', hasPicture: true },
        },
        { id: 'u2', firstName: 'No', lastName: 'Profile', role: 'Candidat' },
      ]);

      const event = await service.findEventWithMembersById(
        'user@example.org',
        'campaign-1'
      );

      expect(
        salesforceService.findAllCampaignMembersByCampaignId
      ).toHaveBeenCalledWith('campaign-1', SalesforceCampaignStatus.REGISTERED);
      expect(usersService.findAllByMail).toHaveBeenCalledWith([
        'a@example.org',
        'b@example.org',
      ]);
      expect(event.participants).toEqual([
        {
          id: 'u1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          role: 'Coach',
          userProfile: { id: 'p1', hasPicture: true },
        },
        {
          id: 'u2',
          firstName: 'No',
          lastName: 'Profile',
          role: 'Candidat',
          userProfile: { id: undefined, hasPicture: undefined },
        },
      ]);
    });
  });

  describe('updateEventParticipation', () => {
    const buildReady = () => {
      const built = build();
      built.salesforceService.findEventCampaignById.mockResolvedValue({
        Id: 'campaign-1',
      });
      built.salesforceService.findContact.mockResolvedValue({
        Id: 'contact-1',
      });
      return built;
    };

    it('registers the contact when participating', async () => {
      const { service, salesforceService } = buildReady();

      await service.updateEventParticipation('u@example.org', 'e', true, 'u1');

      expect(
        salesforceService.createOrUpdateCampaignMember
      ).toHaveBeenCalledWith(
        { contactId: 'contact-1' },
        'campaign-1',
        SalesforceCampaignStatus.REGISTERED
      );
    });

    it('marks the contact as having responded when leaving the event', async () => {
      const { service, salesforceService } = buildReady();

      await service.updateEventParticipation('u@example.org', 'e', false, 'u1');

      expect(
        salesforceService.createOrUpdateCampaignMember
      ).toHaveBeenCalledWith(
        { contactId: 'contact-1' },
        'campaign-1',
        SalesforceCampaignStatus.RESPONDED
      );
    });

    it('fails when the campaign does not exist', async () => {
      const { service, salesforceService } = buildReady();
      salesforceService.findEventCampaignById.mockResolvedValue(null);

      await expect(
        service.updateEventParticipation('u@example.org', 'e', true, 'u1')
      ).rejects.toThrow('Event with ID e not found in Salesforce');
    });

    it('fails when the Salesforce contact does not exist', async () => {
      const { service, salesforceService } = buildReady();
      salesforceService.findContact.mockResolvedValue(null);

      await expect(
        service.updateEventParticipation('u@example.org', 'e', true, 'u1')
      ).rejects.toThrow('Contact with email u@example.org not found');
      expect(
        salesforceService.createOrUpdateCampaignMember
      ).not.toHaveBeenCalled();
    });

    it('hides the Salesforce error when the update fails', async () => {
      const { service, salesforceService } = buildReady();
      salesforceService.createOrUpdateCampaignMember.mockRejectedValue(
        new Error('salesforce secret')
      );

      await expect(
        service.updateEventParticipation('u@example.org', 'e', true, 'u1')
      ).rejects.toThrow('Failed to update event participation');
    });
  });
});

describe('EventsController', () => {
  const build = () => {
    const eventsService = {
      findAllEvents: jest.fn().mockResolvedValue(['event']),
      findEventWithMembersById: jest.fn(),
      updateEventParticipation: jest.fn().mockResolvedValue(undefined),
    };
    return {
      controller: new EventsController(eventsService as never),
      eventsService,
    };
  };

  it('lists the events with the filters of the query', async () => {
    const { controller, eventsService } = build();
    const query = Object.assign(new FindAllEventsQueryDto(), {
      limit: 20,
      offset: 40,
      includePastEvents: true,
      isParticipating: 'true',
      search: 'cafe',
      modes: [EventMode.ONLINE],
    });

    const result = await controller.findAll('u@example.org', 'u1', query);

    expect(result).toEqual(['event']);
    const args = eventsService.findAllEvents.mock.calls[0];
    expect(args[0]).toBe('u@example.org');
    expect(args.slice(1, 7)).toEqual([20, 40, true, true, 'cafe', ['online']]);
    expect(args[10]).toBe('u1');
  });

  it.each([
    ['true', true],
    ['false', false],
    [undefined, null],
  ])('maps the participation filter %s to %s', async (value, expected) => {
    const { controller, eventsService } = build();

    await controller.findAll(
      'u@example.org',
      'u1',
      Object.assign(new FindAllEventsQueryDto(), { isParticipating: value })
    );

    expect(eventsService.findAllEvents.mock.calls[0][4]).toBe(expected);
  });

  it('returns an event and its participants', async () => {
    const { controller, eventsService } = build();
    eventsService.findEventWithMembersById.mockResolvedValue({
      id: 'e1',
      participants: [{ id: 'u2' }],
    });

    await expect(
      controller.findById('u@example.org', 'u1', 'e1')
    ).resolves.toEqual({ id: 'e1', participants: [{ id: 'u2' }] });
    await expect(
      controller.findParticipantsByEventId('u@example.org', 'u1', 'e1')
    ).resolves.toEqual([{ id: 'u2' }]);
  });

  it('answers not found for an unknown event', async () => {
    const { controller, eventsService } = build();
    eventsService.findEventWithMembersById.mockResolvedValue(null);

    await expect(
      controller.findById('u@example.org', 'u1', 'e1')
    ).rejects.toThrow(NotFoundException);
    await expect(
      controller.findParticipantsByEventId('u@example.org', 'u1', 'e1')
    ).rejects.toThrow(NotFoundException);
  });

  it('toggles the participation of the logged in user', async () => {
    const { controller, eventsService } = build();

    await controller.toggleParticipation('u@example.org', 'u1', 'e1', {
      participate: false,
    });

    expect(eventsService.updateEventParticipation).toHaveBeenCalledWith(
      'u@example.org',
      'e1',
      false,
      'u1'
    );
  });

  it('rejects a participation body that is not a boolean or has extra fields', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      pipe.transform(
        { participate: 'yes' },
        { type: 'body', metatype: EventParticipationDto }
      )
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        { participate: true, admin: true },
        { type: 'body', metatype: EventParticipationDto }
      )
    ).rejects.toThrow();
  });
});
