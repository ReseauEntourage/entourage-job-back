import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { UserPayload } from 'src/auth/guards';
import { Timeout } from 'src/common/decorators/timeout.decorator';
import { AiAssistantService } from './ai-assistant.service';
import { AiStreamDto } from './dto/ai-stream.dto';
import { AiStreamPipe } from './dto/ai-stream.pipe';
import { AssistantRecipientGuard } from './guards/assistant-recipient.guard';
import { AiAssistantMessage } from './models/ai-assistant-message.model';

export const AI_ASSISTANT_STREAM_TIMEOUT_MS = 120000;

@ApiTags('AI Assistant')
@ApiBearerAuth()
@Controller('ai-assistant')
export class AiAssistantController {
  readonly logger = new Logger(AiAssistantController.name);

  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @UseGuards(AssistantRecipientGuard)
  @Get('recipients/:recipientId/session')
  async getSession(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('recipientId', new ParseUUIDPipe()) recipientId: string
  ) {
    const session = await this.aiAssistantService.getSession(
      recipientId,
      userId
    );
    return session ?? { messages: [] as AiAssistantMessage[] };
  }

  @UseGuards(AssistantRecipientGuard)
  @Post('recipients/:recipientId/stream')
  @Sse()
  // The global TimeoutInterceptor errors after 30s without emission, which
  // would cut the stream if the model pauses (slow first token, provider hiccup).
  @Timeout(AI_ASSISTANT_STREAM_TIMEOUT_MS)
  streamResponse(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('recipientId', new ParseUUIDPipe()) recipientId: string,
    @Body(new AiStreamPipe()) dto: AiStreamDto
  ): Observable<MessageEvent> {
    return this.aiAssistantService.streamResponse(
      recipientId,
      userId,
      dto.message
    );
  }

  @UseGuards(AssistantRecipientGuard)
  @Delete('recipients/:recipientId/session/messages')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetSession(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('recipientId', new ParseUUIDPipe()) recipientId: string
  ) {
    await this.aiAssistantService.resetSession(recipientId, userId);
  }
}
