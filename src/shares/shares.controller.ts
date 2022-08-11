import { Body, Controller, Get, ParseUUIDPipe, Post } from '@nestjs/common';
import { Public } from 'src/auth/guards';
import { SharesService, ShareType } from './shares.service';

@Controller('user')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Public()
  @Get('shares')
  async findTotalShare() {
    const total = await this.sharesService.countTotal();
    return { total };
  }

  @Public()
  @Post('count')
  async updateShareCount(
    @Body('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Body('candidateId') type: ShareType
  ) {
    return this.sharesService.updateByCandidateId(candidateId, type);
  }
}
