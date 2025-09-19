import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/auth/guards';
import { SkillsService } from './skills.service';

@ApiTags('Skills')
@ApiBearerAuth()
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Public()
  @Get()
  async findAll(
    @Query('limit', new ParseIntPipe()) limit?: number,
    @Query('offset', new ParseIntPipe()) offset?: number,
    @Query('search') search?: string
  ) {
    return await this.skillsService.findAll(limit, offset, search);
  }
}
