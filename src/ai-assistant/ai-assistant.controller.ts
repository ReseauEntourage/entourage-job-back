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
import { UserInConversation } from 'src/messaging/guards/user-in-conversation';
import { AiAssistantService } from './ai-assistant.service';
import { AiStreamDto } from './dto/ai-stream.dto';
import { AiStreamPipe } from './dto/ai-stream.pipe';
import { AiAssistantMessage } from './models/ai-assistant-message.model';

@ApiTags('AI Assistant')
@ApiBearerAuth()
@Controller('ai-assistant')
export class AiAssistantController {
  readonly logger = new Logger(AiAssistantController.name);

  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @UseGuards(UserInConversation)
  @Get('conversations/:conversationId/session')
  async getSession(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string
  ) {
    const session = await this.aiAssistantService.getSession(
      conversationId,
      userId
    );
    return session ?? { messages: [] as AiAssistantMessage[] };
  }

  @UseGuards(UserInConversation)
  @Post('conversations/:conversationId/stream')
  @Sse()
  streamResponse(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Body(new AiStreamPipe()) dto: AiStreamDto
  ): Observable<MessageEvent> {
    return this.aiAssistantService.streamResponse(
      conversationId,
      userId,
      dto.message
    );
  }

  @UseGuards(UserInConversation)
  @Delete('conversations/:conversationId/session/messages')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetSession(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string
  ) {
    await this.aiAssistantService.resetSession(conversationId, userId);
  }
}
