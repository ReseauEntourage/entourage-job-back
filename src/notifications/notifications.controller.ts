import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { MarkNotificationsSeenDto } from './dto';
import { NotificationsService } from './notifications.service';

const bodyPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

/**
 * The bell of the logged-in user: their own notifications only. Opening the
 * list marks nothing as seen: only the display of a content does.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @UserPayload('id') userId: string,
    @Query('cursor') cursor?: string
  ) {
    return this.notificationsService.findPage(userId, cursor);
  }

  @Get('unseen-count')
  async countUnseen(@UserPayload('id') userId: string) {
    return { count: await this.notificationsService.countUnseen(userId) };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('seen')
  async markSeen(
    @UserPayload('id') userId: string,
    @Body(bodyPipe) dto: MarkNotificationsSeenDto
  ) {
    await this.notificationsService.markSeen(userId, dto.messageIds);
  }
}
