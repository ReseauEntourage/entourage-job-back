import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/auth/guards';
import { BusinessSectorsService } from './business-sectors.service';
import { BusinessSector } from './models';

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
    const businessSectors = await this.businessSectorsService.findAll(
      limit,
      offset,
      search
    );

    return Promise.all(
      businessSectors.map(async (businessSector) => {
        return {
          ...(businessSector.toJSON() as BusinessSector),
        } as BusinessSector;
      })
    );
  }
}
