import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/auth/guards';
import { SharesService } from './shares.service';

@Controller('api/v1/cv')
export class SharesControllerOld {
  constructor(private readonly sharesService: SharesService) {}

  // TODO remove after RDR
  @Public()
  @Get('shares')
  async countTotalShares() {
    const total = await this.sharesService.countTotal();
    return { total };
  }
}
