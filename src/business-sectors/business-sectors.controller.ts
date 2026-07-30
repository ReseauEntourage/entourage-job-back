import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/auth/guards';
import { BusinessSectorsService } from './business-sectors.service';

@ApiTags('BusinessSectors')
@ApiBearerAuth()
@Controller('business-sectors')
export class BusinessSectorsController {
  constructor(
    private readonly businessSectorsService: BusinessSectorsService
  ) {}

  @Public()
  @Get()
  async findAll(
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('offset', new ParseIntPipe()) offset: number,
    @Query('search') search?: string
  ) {
    return await this.businessSectorsService.findAll(limit, offset, search);
  }
}
