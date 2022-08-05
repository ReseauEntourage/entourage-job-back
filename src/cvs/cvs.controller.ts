import {
  Controller,
  Get,
  NotFoundException,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CVsService } from './cvs.service';

// TODO fix
// eslint-disable-next-line no-restricted-imports
import { LinkedUserGuard } from 'src/users/guards/linked-user.guard';
// TODO fix
// eslint-disable-next-line no-restricted-imports
import { LinkedUser } from 'src/users/guards/linked-user.decorator';

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
