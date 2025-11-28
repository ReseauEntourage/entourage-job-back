import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { EventParticipationDto } from './dto/event-participation.dto';
import { EventParticipationPipe } from './dto/event-participation.pipe';
import { EventMode, EventType } from './event.types';
import { EventsService } from './events.service';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async findAll(
    @UserPayload('email') currentUserEmail: string,
    @Query('limit', new DefaultValuePipe(50), new ParseIntPipe())
    limit: number,
    @Query('offset', new DefaultValuePipe(0), new ParseIntPipe())
    offset: number,
    @Query('search')
    search?: string,
    @Query('modes')
    modes?: EventMode[],
    @Query('eventTypes')
    eventTypes?: EventType[],
    @Query('departmentIds')
    departmentIds?: string[]
  ) {
    const events = await this.eventsService.findAllEvents(
      currentUserEmail,
      limit,
      offset,
      search,
      modes,
      eventTypes,
      departmentIds
    );

    return events;
  }

  @Get(':eventId')
  async findById(
    @UserPayload('email') userEmail: string,
    @Param('eventId') eventId: string
  ) {
    const event = await this.eventsService.findEventWithMembersById(
      userEmail,
      eventId
    );
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  @Get(':eventId/participants')
  async findParticipantsByEventId(
    @UserPayload('email') userEmail: string,
    @Param('eventId') eventId: string
  ) {
    const eventWithParticipants =
      await this.eventsService.findEventWithMembersById(userEmail, eventId);
    if (!eventWithParticipants) {
      throw new NotFoundException('Event not found');
    }
    return eventWithParticipants.participants;
  }

  @Put(':eventId/participation')
  async toggleParticipation(
    @UserPayload('email') userEmail: string,
    @Param('eventId') eventId: string,
    @Body(EventParticipationPipe) eventParticipationDto: EventParticipationDto
  ) {
    return this.eventsService.updateEventParticipation(
      userEmail,
      eventId,
      eventParticipationDto.participate
    );
  }
}
