import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, UserPayload } from 'src/auth/guards';
import { User } from 'src/users/models';
import { CreateRecruitementAlertDto, UpdateRecruitementAlertDto } from './dto';
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
    try {
      return await this.recruitementAlertsService.create(
        createRecruitementAlertDto
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  @Get()
  async getRecruitementAlerts(@UserPayload() user: User) {
    try {
      const userId = user.id;
      return await this.recruitementAlertsService.findAllByUserId(userId);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  @Get(':id/matching')
  async getRecruitementAlertMatching(@Param('id') alertId: string) {
    try {
      return await this.recruitementAlertsService.getRecruitementAlertMatching(
        alertId
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  @Delete(':id')
  async deleteRecruitementAlert(@Param('id') alertId: string) {
    try {
      return await this.recruitementAlertsService.delete(alertId);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  @Put(':id')
  async updateRecruitementAlert(
    @Param('id') alertId: string,
    @Body() updateRecruitementAlertDto: UpdateRecruitementAlertDto
  ) {
    try {
      return await this.recruitementAlertsService.update(
        alertId,
        updateRecruitementAlertDto
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
