import {
  Body,
  Controller,
  Get,
  NotFoundException,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/auth/guards';
import { SharesService, ShareType } from './shares.service';

@ApiTags('CVs')
@Controller('cv')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Public()
  @Get('shares')
  async countTotalShares() {
    const total = await this.sharesService.countTotal();
    return { total };
  }

  // TODO use PUT
  @Public()
  @Post('count')
  async updateShareCount(
    @Body('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Body('type') type: ShareType
  ) {
    const updatedShare = await this.sharesService.updateByCandidateId(
      candidateId,
      type
    );
    if (!updatedShare) {
      throw new NotFoundException();
    }
  }
}
