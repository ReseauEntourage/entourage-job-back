import {
  Controller,
  DefaultValuePipe,
  Get,
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
    @Query('mode')
    mode?: EventMode,
    @Query('eventType')
    eventType?: EventType,
    @Query('departmentId')
    departmentId?: string
  ) {
    const events = await this.eventsService.findAllEvents(
      limit,
      offset,
      search,
      mode,
      eventType,
      departmentId
    );

    return events;
  }
}
