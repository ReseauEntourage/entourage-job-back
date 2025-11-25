import {
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EventMode, EventType } from './event.types';
import { EventsService } from './events.service';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async findAll(
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
  async findById(@Param('eventId') eventId: string) {
    const event = await this.eventsService.findEventById(eventId);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }
}
