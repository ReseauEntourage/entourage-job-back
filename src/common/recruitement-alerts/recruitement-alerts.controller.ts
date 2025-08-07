import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards';
import { RecruitementAlertsService } from './recruitement-alerts.service';

@ApiTags('recruitement-alerts')
@Controller('recruitement-alerts')
@UseGuards(JwtAuthGuard)
export class RecruitementAlertsController {
  constructor(
    private readonly recruitementAlertsService: RecruitementAlertsService
  ) {}
}
