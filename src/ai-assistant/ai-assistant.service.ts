import {
  Inject,
  Injectable,
  Logger,
  MessageEvent,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import Redis from 'ioredis';
import { Observable, Subscriber } from 'rxjs';
import { Order } from 'sequelize';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Occupation } from 'src/common/occupations/models';
import { Skill } from 'src/common/skills/models';
import { AnthropicService } from 'src/external-services/anthropic/anthropic.service';
import { MessagingService } from 'src/messaging/messaging.service';
import { Organization } from 'src/organizations/models';
import { REDIS_CLIENT } from 'src/redis/redis.module';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileSectorOccupation } from 'src/user-profiles/models/user-profile-sector-occupation.model';
import { UserProfileSkill } from 'src/user-profiles/models/user-profile-skill.model';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { RedisKeys } from 'src/utils/constants/redis';
import { AI_ASSISTANT_CONFIG } from './ai-assistant.config';
import { AiAssistantMessage } from './models/ai-assistant-message.model';
import { AiAssistantSession } from './models/ai-assistant-session.model';

const MAX_CONVERSATION_CONTEXT_MESSAGES = 10;

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  private static readonly RATE_LIMIT_MAX = 10;
  private static readonly RATE_LIMIT_WINDOW_SECONDS = 3600;

  constructor(
    @InjectModel(AiAssistantSession)
    private sessionModel: typeof AiAssistantSession,
    @InjectModel(AiAssistantMessage)
    private messageModel: typeof AiAssistantMessage,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile,
    private messagingService: MessagingService,
    private anthropicService: AnthropicService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis
  ) {}

  async getSession(conversationId: string, userId: string) {
    const session = await this.sessionModel.findOne({
      where: { conversationId, userId },
      include: [
        {
          model: AiAssistantMessage,
          as: 'messages',
          order: [['createdAt', 'ASC']] as Order,
          separate: true,
        },
      ],
    });

    return session;
  }

  async getOrCreateSession(conversationId: string, userId: string) {
    const [session] = await this.sessionModel.findOrCreate({
      where: { conversationId, userId },
      defaults: { conversationId, userId },
    });
    return session;
  }

  async resetSession(conversationId: string, userId: string) {
    const session = await this.sessionModel.findOne({
      where: { conversationId, userId },
    });

    if (!session) {
      return;
    }

    await this.messageModel.destroy({ where: { sessionId: session.id } });
  }

  streamResponse(
    conversationId: string,
    userId: string,
    message: string
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      this.doStream(subscriber, conversationId, userId, message).catch(
        (error) => {
          this.logger.error(
            `AI stream error: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          subscriber.next({ data: { error: 'Une erreur est survenue.' } });
          subscriber.next({ data: '[DONE]' });
          subscriber.complete();
        }
      );
    });
  }

  private async checkRateLimit(
    userId: string
  ): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> {
    const key = `${RedisKeys.RL_AI_ASSISTANT}${userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(
        key,
        AiAssistantService.RATE_LIMIT_WINDOW_SECONDS
      );
    }
    const ttl = await this.redis.ttl(key);
    const resetInSeconds =
      ttl > 0 ? ttl : AiAssistantService.RATE_LIMIT_WINDOW_SECONDS;
    const remaining = Math.max(0, AiAssistantService.RATE_LIMIT_MAX - count);
    return {
      allowed: count <= AiAssistantService.RATE_LIMIT_MAX,
      remaining,
      resetInSeconds,
    };
  }

  private async doStream(
    subscriber: Subscriber<MessageEvent>,
    conversationId: string,
    userId: string,
    message: string
  ) {
    const caller = await this.userModel.findByPk(userId, {
      include: [{ model: Organization, as: 'organization' }],
    });

    if (!caller || caller.role === UserRoles.CANDIDATE) {
      throw new UnauthorizedException(
        "Seuls les accompagnants peuvent utiliser l'assistant IA."
      );
    }

    const { allowed, remaining, resetInSeconds } = await this.checkRateLimit(
      userId
    );

    if (!allowed) {
      subscriber.next({ data: { type: 'rate_limit', resetInSeconds } });
      subscriber.next({ data: '[DONE]' });
      subscriber.complete();
      return;
    }

    subscriber.next({ data: { type: 'rate_limit_info', remaining } });

    const session = await this.getOrCreateSession(conversationId, userId);

    const conversation =
      await this.messagingService.findConversationWithRecentMessages(
        conversationId,
        MAX_CONVERSATION_CONTEXT_MESSAGES
      );

    if (!conversation) {
      throw new NotFoundException('Conversation introuvable.');
    }

    const candidateUser = conversation.participants.find(
      (p) => p.role === UserRoles.CANDIDATE
    );

    const candidateProfile = candidateUser
      ? await this.userProfileModel.findOne({
          where: { userId: candidateUser.id },
          include: [
            {
              model: UserProfileSectorOccupation,
              as: 'sectorOccupations',
              include: [
                {
                  model: BusinessSector,
                  as: 'businessSector',
                  attributes: ['name'],
                },
                { model: Occupation, as: 'occupation', attributes: ['name'] },
              ],
            },
            {
              model: UserProfileSkill,
              as: 'userProfileSkills',
              include: [{ model: Skill, as: 'skill', attributes: ['name'] }],
            },
            {
              model: Experience,
              as: 'experiences',
              attributes: ['title', 'company', 'description'],
            },
            {
              model: Formation,
              as: 'formations',
              attributes: ['title', 'description'],
            },
          ],
        })
      : null;

    const existingMessages = await this.messageModel.findAll({
      where: { sessionId: session.id },
      order: [['createdAt', 'ASC']],
    });

    await this.messageModel.create({
      sessionId: session.id,
      role: 'user',
      content: message,
    });

    const recentConversationMessages = (conversation.messages ?? [])
      .slice(0, MAX_CONVERSATION_CONTEXT_MESSAGES)
      .reverse();

    const systemPrompt = this.buildSystemPrompt(
      caller,
      candidateUser,
      candidateProfile,
      recentConversationMessages
    );

    const anthropicMessages: { role: 'user' | 'assistant'; content: string }[] =
      [
        ...existingMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ];

    const stream = this.anthropicService.createStream(
      systemPrompt,
      anthropicMessages
    );

    let fullText = '';

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        fullText += event.delta.text;
        subscriber.next({ data: { content: event.delta.text } });
      }
    }

    const suggestionRegex = /\[SUGGESTION\]([\s\S]*?)\[\/SUGGESTION\]/g;
    const suggestions: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = suggestionRegex.exec(fullText)) !== null) {
      const trimmed = match[1].trim();
      if (trimmed) {
        suggestions.push(trimmed);
      }
    }

    if (fullText) {
      await this.messageModel.create({
        sessionId: session.id,
        role: 'assistant',
        content: fullText,
      });
    }

    if (suggestions.length > 0) {
      subscriber.next({ data: { type: 'suggest', suggestions } });
    }

    if (candidateUser && fullText) {
      const needsEscalation = await this.checkEscalation(fullText);
      if (needsEscalation) {
        const staffContact = candidateUser.staffContact;
        if (staffContact?.entourageProEmail) {
          const referentUser = await this.userModel.findOne({
            where: { email: staffContact.entourageProEmail.toLowerCase() },
            attributes: ['id'],
          });
          if (referentUser) {
            subscriber.next({
              data: {
                type: 'escalate',
                referentUserId: referentUser.id,
                referentName: staffContact.name,
              },
            });
          }
        }
      }
    }

    subscriber.next({ data: '[DONE]' });
    subscriber.complete();
  }

  private async checkEscalation(text: string): Promise<boolean> {
    try {
      const result = await this.anthropicService.generateText(
        AI_ASSISTANT_CONFIG.escalationClassifierSystem,
        AI_ASSISTANT_CONFIG.escalationClassifierPrompt.replace('{{TEXT}}', text)
      );
      return result.trim().toUpperCase().startsWith('OUI');
    } catch {
      return false;
    }
  }

  private buildSystemPrompt(
    user: User,
    candidateUser: User | undefined,
    candidateProfile: UserProfile | null,
    recentMessages: {
      content: string;
      createdAt?: Date | string;
      author?: { firstName: string; lastName: string };
    }[]
  ): string {
    const today = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const userOrgLine = user.organization?.name
      ? `- Entreprise : ${user.organization.name}`
      : '';

    const candidateName = candidateUser
      ? `${candidateUser.firstName} ${candidateUser.lastName}`
      : 'Candidat inconnu';

    const sectors =
      candidateProfile?.sectorOccupations
        ?.map((so) => so.businessSector?.name)
        .filter(Boolean)
        .join(', ') || 'Non renseigné';

    const occupations =
      candidateProfile?.sectorOccupations
        ?.map((so) => so.occupation?.name)
        .filter(Boolean)
        .join(', ') || 'Non renseigné';

    const skills =
      candidateProfile?.userProfileSkills
        ?.map((s) => s.skill?.name)
        .filter(Boolean)
        .join(', ') || 'Non renseigné';

    const experiences =
      candidateProfile?.experiences
        ?.map((e) => `${e.title ?? ''}${e.company ? ` chez ${e.company}` : ''}`)
        .filter(Boolean)
        .join(', ') || 'Non renseigné';

    const formations =
      candidateProfile?.formations
        ?.map((f) => f.title)
        .filter(Boolean)
        .join(', ') || 'Non renseigné';

    const userName = `${user.firstName} ${user.lastName}`;

    const PROFILE_FIELD_LABELS: [string, string][] = [
      [sectors, "Secteurs d'activité visés"],
      [occupations, 'Métiers visés'],
      [skills, 'Compétences'],
      [experiences, 'Expériences professionnelles'],
      [formations, 'Formations'],
    ];

    const missingFields = PROFILE_FIELD_LABELS.filter(
      ([value]) => value === 'Non renseigné'
    ).map(([, label]) => `- ${label}`);

    const conversationHistory =
      recentMessages.length > 0
        ? recentMessages
            .map((m) => {
              const author = m.author;
              const name = author
                ? `${author.firstName} ${author.lastName}`
                : 'Inconnu';
              const date = m.createdAt
                ? new Date(m.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : null;
              return date
                ? `[${name} – ${date}] : ${m.content}`
                : `[${name}] : ${m.content}`;
            })
            .join('\n')
        : 'Aucun message récent.';

    const fill = (text: string) =>
      text
        .replace(/\{\{USER_NAME\}\}/g, userName)
        .replace(/\{\{CANDIDATE_NAME\}\}/g, candidateName);

    const allFieldsMissing =
      missingFields.length === PROFILE_FIELD_LABELS.length;
    const someFieldsMissing = missingFields.length > 0 && !allFieldsMissing;

    const profileSection = allFieldsMissing
      ? fill(AI_ASSISTANT_CONFIG.emptyProfileInstruction)
      : [
          fill(AI_ASSISTANT_CONFIG.profileInstruction),
          someFieldsMissing
            ? fill(AI_ASSISTANT_CONFIG.missingFieldsNote).replace(
                '{{MISSING_FIELDS}}',
                missingFields.join('\n')
              )
            : '',
        ]
          .filter(Boolean)
          .join('\n\n');

    const rules = AI_ASSISTANT_CONFIG.rules
      .map((r) => `- ${fill(r)}`)
      .join('\n');

    const suggestionFormat = AI_ASSISTANT_CONFIG.suggestionFormat
      .map((r) => `- ${fill(r)}`)
      .join('\n');

    return `${AI_ASSISTANT_CONFIG.role}

CONTEXTE DE LA PLATEFORME :
${AI_ASSISTANT_CONFIG.platformContext}

POSTURE DE COACHING :
${AI_ASSISTANT_CONFIG.coachingPhilosophy}

MISSIONS DES ACCOMPAGNANTS :
${AI_ASSISTANT_CONFIG.coachingScope}

Date du jour : ${today}

UTILISATEUR QUI UTILISE CET ASSISTANT :
- Nom : ${userName}
- Rôle : ${user.role}
${userOrgLine}

PROFIL DU CANDIDAT ACCOMPAGNÉ :
- Nom : ${candidateName}
- Secteurs visés : ${sectors}
- Métiers visés : ${occupations}
- Compétences : ${skills}
- Expériences : ${experiences}
- Formations : ${formations}

${profileSection}

HISTORIQUE RÉCENT DE LA CONVERSATION (${MAX_CONVERSATION_CONTEXT_MESSAGES} derniers messages) :
${conversationHistory}

PRIORITÉS DE DÉCOUVERTE :
${fill(AI_ASSISTANT_CONFIG.discoveryPriorities)}

CAS DIFFICILES :
${fill(AI_ASSISTANT_CONFIG.difficultSituations)}

RÈGLES STRICTES :
${rules}

FORMAT DES MESSAGES SUGGÉRÉS :
${suggestionFormat}

${fill(AI_ASSISTANT_CONFIG.fewShotExample)}`;
  }
}
