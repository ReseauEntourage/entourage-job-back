import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  QueryTypes,
  UniqueConstraintError as SequelizeUniqueConstraintError,
} from 'sequelize';
import { AuthService } from 'src/auth/auth.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { MailsService } from 'src/mails/mails.service';
import { userAttributes } from 'src/messaging/messaging.attributes';
import { messagingParticipantsInclude } from 'src/messaging/messaging.includes';
import { MessagingService } from 'src/messaging/messaging.service';
import {
  Conversation,
  ConversationType,
} from 'src/messaging/models/conversation.model';
import { ServiceMessageKind } from 'src/messaging/models/message.model';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import {
  CHECKIN_ELIGIBILITY_THRESHOLD_DAYS,
  CheckinPerceivedBenefit,
} from './checkin.types';
import { SubmitCheckinAnswerDto } from './dto';
import { ConversationCheckin } from './models';

export interface CheckinEligibility {
  eligible: boolean;
  otherParticipant: User | null;
}

export interface CheckinMailRecipient {
  conversationId: string;
  userId: string;
}

// Checkin invitation mails are a low-urgency reminder sent 30 days after a conversation's
// engagement threshold by a daily cron, not an urgent new-message notification — so they
// get a longer autologin token lifetime than AuthService's 12h default.
const CHECKIN_INVITATION_AUTOLOGIN_TOKEN_EXPIRATION_MS =
  7 * 24 * 60 * 60 * 1000;

const ANSWER_FIELDS: (keyof SubmitCheckinAnswerDto)[] = [
  'stillInTouch',
  'exchangeModes',
  'exchangeFrequency',
  'perceivedBenefits',
  'employmentType',
  'perceivedSupport',
  'rating',
  'comment',
];

@Injectable()
export class CheckinService {
  constructor(
    @InjectModel(ConversationCheckin)
    private conversationCheckinModel: typeof ConversationCheckin,
    @InjectModel(Conversation)
    private conversationModel: typeof Conversation,
    @Inject(forwardRef(() => MessagingService))
    private messagingService: MessagingService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
    private slackService: SlackService,
    private mailsService: MailsService
  ) {}

  private async getConversationForParticipant(
    conversationId: string,
    userId: string
  ): Promise<Conversation> {
    const conversation = await this.conversationModel.findByPk(conversationId, {
      include: [
        {
          model: User,
          as: 'participants',
          attributes: userAttributes,
          include: [messagingParticipantsInclude],
        },
      ],
    });
    if (!conversation) {
      throw new NotFoundException('CONVERSATION_NOT_FOUND');
    }
    const isParticipant = conversation.participants.some(
      (participant) => participant.id === userId
    );
    if (!isParticipant) {
      throw new ForbiddenException('NOT_A_PARTICIPANT');
    }
    return conversation;
  }

  isEligible(conversation: Conversation): boolean {
    if (conversation.type !== ConversationType.DIRECT) {
      return false;
    }
    if (!conversation.engagementThresholdReachedAt) {
      return false;
    }
    const thresholdDate = new Date(conversation.engagementThresholdReachedAt);
    thresholdDate.setDate(
      thresholdDate.getDate() + CHECKIN_ELIGIBILITY_THRESHOLD_DAYS
    );
    return thresholdDate.getTime() <= Date.now();
  }

  async getEligibility(
    conversationId: string,
    userId: string
  ): Promise<CheckinEligibility> {
    const conversation = await this.getConversationForParticipant(
      conversationId,
      userId
    );
    const otherParticipant =
      conversation.participants.find(
        (participant) => participant.id !== userId
      ) ?? null;
    return { eligible: this.isEligible(conversation), otherParticipant };
  }

  async getCheckin(
    conversationId: string,
    userId: string
  ): Promise<ConversationCheckin | null> {
    return this.conversationCheckinModel.findOne({
      where: { conversationId, userId },
    });
  }

  /**
   * Applies whichever answer fields are present on the dto to the checkin, rejecting
   * any field that has already been answered. Shared between the create and update
   * paths of `submitAnswer`.
   */
  private applyAnswerFields(
    checkin: ConversationCheckin,
    dto: SubmitCheckinAnswerDto
  ): void {
    for (const field of ANSWER_FIELDS) {
      if (dto[field] === undefined) {
        continue;
      }
      if (checkin[field] !== null && checkin[field] !== undefined) {
        throw new ConflictException('CHECKIN_ANSWER_ALREADY_SUBMITTED');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (checkin as any)[field] = dto[field];
    }
  }

  async submitAnswer(
    conversationId: string,
    userId: string,
    dto: SubmitCheckinAnswerDto
  ): Promise<ConversationCheckin> {
    const conversation = await this.getConversationForParticipant(
      conversationId,
      userId
    );
    if (!this.isEligible(conversation)) {
      throw new ForbiddenException('CHECKIN_NOT_ELIGIBLE');
    }

    if (
      dto.perceivedBenefits?.includes(CheckinPerceivedBenefit.NOTHING_YET) &&
      dto.perceivedBenefits.length > 1
    ) {
      throw new BadRequestException(
        'perceivedBenefits: NOTHING_YET cannot be combined with other values'
      );
    }

    let checkin = await this.getCheckin(conversationId, userId);
    if (!checkin) {
      const hasAnyAnswer = ANSWER_FIELDS.some(
        (field) => dto[field] !== undefined
      );
      if (!hasAnyAnswer) {
        throw new BadRequestException(
          'Le bilan doit être initié en répondant à au moins une question'
        );
      }

      checkin = this.conversationCheckinModel.build({ conversationId, userId });
      this.applyAnswerFields(checkin, dto);
      try {
        await checkin.save();
        return checkin;
      } catch (error) {
        if (!(error instanceof SequelizeUniqueConstraintError)) {
          throw error;
        }
        // Lost the race against a concurrent submitAnswer call that created the row
        // for this (conversationId, userId) pair first — re-fetch it and apply this
        // call's answers on top of the now-existing row instead of surfacing a 500.
        const existingCheckin = await this.getCheckin(conversationId, userId);
        if (!existingCheckin) {
          throw error;
        }
        checkin = existingCheckin;
      }
    }

    this.applyAnswerFields(checkin, dto);
    await checkin.save();
    return checkin;
  }

  async requestStaffContact(
    conversationId: string,
    userId: string
  ): Promise<ConversationCheckin> {
    const checkin = await this.getCheckin(conversationId, userId);
    if (!checkin || checkin.rating === null || checkin.rating === undefined) {
      throw new NotFoundException('CHECKIN_NOT_FOUND');
    }
    if (checkin.rating > 2) {
      throw new ForbiddenException('CHECKIN_RATING_NOT_ELIGIBLE_FOR_CONTACT');
    }
    if (checkin.contactRequestedAt) {
      return checkin;
    }

    // Atomic conditional update instead of check-then-set: only the call that
    // actually flips contactRequestedAt from null to non-null wins the right to
    // send the Slack alert, so two concurrent requests can't both send it.
    const [affectedCount] = await this.conversationCheckinModel.update(
      { contactRequestedAt: new Date() },
      { where: { id: checkin.id, contactRequestedAt: null } }
    );

    if (affectedCount === 1) {
      const [conversation, user] = await Promise.all([
        this.getConversationForParticipant(conversationId, userId),
        this.usersService.findOneWithRelations(userId),
      ]);
      const otherParticipant =
        conversation.participants.find(
          (participant) => participant.id !== userId
        ) ?? null;
      await this.slackService.sendCheckinContactRequestAlert(
        user,
        checkin,
        otherParticipant
      );
    }

    // Reload so the returned checkin reflects contactRequestedAt as actually
    // persisted, whether this call won the update or a concurrent one did.
    await checkin.reload();
    return checkin;
  }

  async sendNoteToOtherParticipant(
    conversationId: string,
    userId: string,
    content: string
  ): Promise<ConversationCheckin> {
    const [checkin, user] = await Promise.all([
      this.getCheckin(conversationId, userId),
      this.usersService.findOneWithRelations(userId),
    ]);
    if (!checkin || checkin.rating === null || checkin.rating === undefined) {
      throw new NotFoundException('CHECKIN_NOT_FOUND');
    }
    if (checkin.rating < 4) {
      throw new ForbiddenException('CHECKIN_RATING_NOT_ELIGIBLE_FOR_NOTE');
    }
    if (checkin.noteSentAt) {
      return checkin;
    }

    // Atomic conditional update instead of check-then-set: only the call that
    // actually flips noteSentAt from null to non-null wins the right to create
    // the service message, so two concurrent requests can't both send it.
    const [affectedCount] = await this.conversationCheckinModel.update(
      { noteSentAt: new Date() },
      { where: { id: checkin.id, noteSentAt: null } }
    );

    if (affectedCount === 1) {
      await this.messagingService.createServiceMessage(
        conversationId,
        `💬 ${user.firstName} vous a laissé un mot suite à son bilan de conversation :\n\n« ${content} »`,
        ServiceMessageKind.CHECKIN_NOTE,
        { authorFirstName: user.firstName, quotedText: content }
      );
    }

    // Reload so the returned checkin reflects noteSentAt as actually
    // persisted, whether this call won the update or a concurrent one did.
    await checkin.reload();
    return checkin;
  }

  /**
   * Participants of direct conversations whose `engagementThresholdReachedAt` is
   * exactly `daysThreshold` days old (1-day window) and who have no `ConversationCheckin`
   * record yet for that conversation — shared by the daily invitation (J+30) and relance
   * (J+37) jobs. Mirrors the `BETWEEN NOW()-N+1 AND NOW()-N` pattern used by
   * `MessagingService.getAllMutuallyRepliedConversations`.
   */
  async getEligibleCheckinParticipants(
    daysThreshold: number
  ): Promise<CheckinMailRecipient[]> {
    return this.conversationModel.sequelize.query(
      `
        SELECT cp."conversationId" AS "conversationId", cp."userId" AS "userId"
        FROM "Conversations" c
        JOIN "ConversationParticipants" cp ON cp."conversationId" = c.id
        WHERE c.type = :type
          AND c."engagementThresholdReachedAt" IS NOT NULL
          AND c."engagementThresholdReachedAt" BETWEEN
            (NOW() - make_interval(days => :daysPlusOne))
            AND (NOW() - make_interval(days => :days))
          AND NOT EXISTS (
            SELECT 1 FROM "ConversationCheckins" cc
            WHERE cc."conversationId" = cp."conversationId"
              AND cc."userId" = cp."userId"
          )
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          type: ConversationType.DIRECT,
          days: daysThreshold,
          daysPlusOne: daysThreshold + 1,
        },
      }
    );
  }

  /**
   * Sends a checkin mail (invitation or relance, depending on `sendMail`) to each
   * recipient, with an autologin token pointing directly to the checkin screen. Fetches
   * all involved conversations in a single batched query (instead of one findByPk per
   * recipient) to avoid N+1 queries when called from the daily cron with many recipients.
   * Returns one settled result per input recipient, in the same order, so callers can
   * report per-recipient success/failure.
   */
  private async sendCheckinMailsToRecipients(
    recipients: CheckinMailRecipient[],
    sendMail: (
      addressee: User,
      otherParticipant: User,
      conversationId: string,
      autologinToken: string
    ) => Promise<unknown>
  ): Promise<PromiseSettledResult<void>[]> {
    const conversationIds = [
      ...new Set(recipients.map((recipient) => recipient.conversationId)),
    ];
    const conversations = await this.conversationModel.findAll({
      where: { id: conversationIds },
      include: [{ model: User, as: 'participants' }],
    });
    const conversationsById = new Map(
      conversations.map((conversation) => [conversation.id, conversation])
    );

    return Promise.allSettled(
      recipients.map(async ({ conversationId, userId }) => {
        const conversation = conversationsById.get(conversationId);
        const addressee = conversation?.participants.find(
          (participant) => participant.id === userId
        );
        const otherParticipant = conversation?.participants.find(
          (participant) => participant.id !== userId
        );
        if (!conversation || !addressee || !otherParticipant) {
          return;
        }
        const autologinToken = await this.authService.generateAutologinToken(
          addressee.id,
          CHECKIN_INVITATION_AUTOLOGIN_TOKEN_EXPIRATION_MS
        );
        await sendMail(
          addressee,
          otherParticipant,
          conversation.id,
          autologinToken
        );
      })
    );
  }

  async sendInvitationMails(
    recipients: CheckinMailRecipient[]
  ): Promise<PromiseSettledResult<void>[]> {
    return this.sendCheckinMailsToRecipients(
      recipients,
      (addressee, otherParticipant, conversationId, autologinToken) =>
        this.mailsService.sendCheckinInvitationMail(
          addressee,
          otherParticipant,
          conversationId,
          autologinToken
        )
    );
  }

  async sendRelanceMails(
    recipients: CheckinMailRecipient[]
  ): Promise<PromiseSettledResult<void>[]> {
    return this.sendCheckinMailsToRecipients(
      recipients,
      (addressee, otherParticipant, conversationId, autologinToken) =>
        this.mailsService.sendCheckinRelanceMail(
          addressee,
          otherParticipant,
          conversationId,
          autologinToken
        )
    );
  }
}
