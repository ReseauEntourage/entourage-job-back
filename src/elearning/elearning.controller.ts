import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { UserRole } from 'src/users/users.types';
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

  @Post('/units/:unitId/completions')
  async createElearningCompletion(
    @UserPayload('id') userId: string,
    @Param('unitId')
    unitId: string
  ) {
    return this.elearningService.createElearningCompletion(userId, unitId);
  }

  @Delete('/units/:unitId/completions')
  async deleteElearningCompletion(
    @UserPayload('id') userId: string,
    @Param('unitId')
    unitId: string
  ) {
    return this.elearningService.deleteElearningCompletion(userId, unitId);
  }
}
