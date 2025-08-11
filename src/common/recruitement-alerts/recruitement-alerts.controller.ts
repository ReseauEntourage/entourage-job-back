import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards';
import { CreateRecruitementAlertDto } from './dto';
import { RecruitementAlertsService } from './recruitement-alerts.service';

@ApiTags('recruitement-alerts')
@Controller('recruitement-alerts')
@UseGuards(JwtAuthGuard)
export class RecruitementAlertsController {
  constructor(
    private readonly recruitementAlertsService: RecruitementAlertsService
  ) {}

  @Post()
  async create(@Body() createRecruitementAlertDto: CreateRecruitementAlertDto) {
    return await this.recruitementAlertsService.create(
      createRecruitementAlertDto
    );
  }
}
