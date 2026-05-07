import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { AnthropicModule } from 'src/external-services/anthropic/anthropic.module';
import { LlmMetricsModule } from 'src/external-services/llm-metrics/llm-metrics.module';
import { UserInConversation } from 'src/messaging/guards/user-in-conversation';
import { MessagingModule } from 'src/messaging/messaging.module';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileSectorOccupation } from 'src/user-profiles/models/user-profile-sector-occupation.model';
import { UserProfileSkill } from 'src/user-profiles/models/user-profile-skill.model';
import { User } from 'src/users/models';
import { UsersModule } from 'src/users/users.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantMessage } from './models/ai-assistant-message.model';
import { AiAssistantSession } from './models/ai-assistant-session.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      AiAssistantSession,
      AiAssistantMessage,
      User,
      UserProfile,
      UserProfileSectorOccupation,
      UserProfileSkill,
      Experience,
      Formation,
    ]),
    MessagingModule,
    AnthropicModule,
    LlmMetricsModule,
    UsersModule,
  ],
  controllers: [AiAssistantController],
  providers: [AiAssistantService, UserInConversation],
})
export class AiAssistantModule {}
