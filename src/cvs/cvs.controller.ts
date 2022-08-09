import {
  Controller,
  Get,
  NotFoundException,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LinkedUserGuard, LinkedUser } from 'src/users/guards';
import { CVsService } from './cvs.service';

// TODO change to /cvs
@Controller('cv')
export class CVsController {
  constructor(private readonly cvsService: CVsService) {}

  // TODO put userId as Param
  @LinkedUser('query.userId')
  @UseGuards(LinkedUserGuard)
  @Get()
  async findCV(@Query('userId', new ParseUUIDPipe()) candidateId: string) {
    const cv = await this.cvsService.findOneByCandidateId(candidateId);

    if (!cv) {
      throw new NotFoundException();
    }
    return cv;
  }
}
