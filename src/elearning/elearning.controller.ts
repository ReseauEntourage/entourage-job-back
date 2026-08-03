import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserPayload } from 'src/auth/guards';
import type { UserRole } from 'src/users/users.types';
import { ElearningService } from './elearning.service';

@ApiTags('Elearning')
@ApiBearerAuth()
@Controller('elearning')
export class ElearningController {
  constructor(private readonly elearningService: ElearningService) {}

  @Get('units')
  async findAllUnits(
    @Query('limit', new DefaultValuePipe(50), new ParseIntPipe())
    limit: number,
    @Query('offset', new DefaultValuePipe(0), new ParseIntPipe())
    offset: number,
    @Query('role') userRole?: UserRole,
    @UserPayload('id') userId?: string
  ) {
    return this.elearningService.findAllUnits(limit, offset, userRole, userId);
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('/units/:unitId/completions')
  async createElearningCompletion(
    @UserPayload('id') userId: string,
    @UserPayload('role') userRole: UserRole,
    @Param('unitId')
    unitId: string
  ) {
    return this.elearningService.createElearningCompletion(
      userId,
      unitId,
      userRole
    );
  }
}
