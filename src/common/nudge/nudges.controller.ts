import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/auth/guards';
import { Nudge } from './models';
import { NudgesService } from './nudges.service';

@ApiTags('Nudges')
@ApiBearerAuth()
@Controller('nudges')
export class NudgesController {
  constructor(private readonly nudgesService: NudgesService) {}

  @Public()
  @Get()
  async findAll(
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('offset', new ParseIntPipe()) offset: number,
    @Query('search') search?: string
  ) {
    const nudges = await this.nudgesService.findAll(limit, offset, search);

    return Promise.all(
      nudges.map(async (nudge: Nudge) => {
        return {
          ...(nudge.toJSON() as Nudge),
        } as Nudge;
      })
    );
  }
}
