import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { CheckinService } from './checkin.service';
import { SendCheckinNoteDto, SubmitCheckinAnswerDto } from './dto';

@ApiTags('Checkin')
@ApiBearerAuth()
@Controller('checkin')
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Get(':conversationId')
  async getCheckin(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string
  ) {
    const [eligibility, checkin] = await Promise.all([
      this.checkinService.getEligibility(conversationId, userId),
      this.checkinService.getCheckin(conversationId, userId),
    ]);
    return { ...eligibility, checkin };
  }

  @Put(':conversationId')
  async submitAnswer(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: SubmitCheckinAnswerDto
  ) {
    return this.checkinService.submitAnswer(conversationId, userId, dto);
  }

  @Post(':conversationId/contact-request')
  async requestStaffContact(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string
  ) {
    return this.checkinService.requestStaffContact(conversationId, userId);
  }

  @Post(':conversationId/note')
  async sendNote(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: SendCheckinNoteDto
  ) {
    return this.checkinService.sendNoteToOtherParticipant(
      conversationId,
      userId,
      dto.content
    );
  }
}
