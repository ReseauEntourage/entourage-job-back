import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { MailsService } from 'src/mails/mails.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UserRole, UserRoles } from 'src/users/users.types';
import {
  ELEARNING_UNIT_ATTRIBUTES,
  ELEARNING_COMPLETION_ATTRIBUTES,
} from './elearning.attributes';
import { generateElearningUnitIncludes } from './elearning.includes';
import { ElearningCompletion } from './models/elearning-completion.model';
import { ElearningUnit } from './models/elearning-unit.model';

@Injectable()
export class ElearningService {
  private readonly logger = new Logger(ElearningService.name);

  constructor(
    @InjectModel(ElearningUnit)
    private elearningUnitModel: typeof ElearningUnit,
    @InjectModel(ElearningCompletion)
    private elearningCompletionModel: typeof ElearningCompletion,
    readonly mailsService: MailsService,
    readonly usersService: UsersService
  ) {}

  /**
   * Find all elearning units with optional pagination and role filtering.
   * @param limit The maximum number of units to return
   * @param offset The number of units to skip
   * @param role Optional user role to filter units
   * @returns A promise that resolves to an array of ElearningUnit
   */
  async findAllUnits(
    limit: number,
    offset: number,
    userRole?: UserRole,
    userId?: string
  ): Promise<ElearningUnit[]> {
    return this.elearningUnitModel.findAll({
      attributes: ELEARNING_UNIT_ATTRIBUTES,
      include: generateElearningUnitIncludes({ userRole, userId }),
      limit,
      offset,
      order: [['order', 'ASC']],
    });
  }

  /**
   * Find an elearning completion by its ID.
   * @param completionId The ID of the elearning completion
   * @returns The found ElearningCompletion or null if not found
   */
  async findOneElearningCompletionById(
    completionId: string
  ): Promise<ElearningCompletion | null> {
    return this.elearningCompletionModel.findOne({
      where: { id: completionId },
      attributes: ELEARNING_COMPLETION_ATTRIBUTES,
    });
  }

  /**
   * Create a new elearning completion for a user and unit.
   * @param userId The ID of the user
   * @param unitId The ID of the elearning unit
   * @returns The created ElearningCompletion
   * @throws ConflictException if the completion already exists
   * @throws NotFoundException if the elearning unit does not exist
   */
  async createElearningCompletion(userId: string, unitId: string) {
    // Check the unitId exists
    const unit = await this.elearningUnitModel.findByPk(unitId);
    if (!unit) {
      throw new NotFoundException('Elearning unit not found');
    }

    // Check if the completion already exists
    const existingCompletion = await this.elearningCompletionModel.findOne({
      where: { userId, unitId },
    });
    if (existingCompletion) {
      throw new ConflictException(
        'Completion already exists for this user and unit'
      );
    }

    // Create the completion
    const completion = await this.elearningCompletionModel.create({
      userId,
      unitId,
      validatedAt: new Date(),
    });

    await this.onElearningUnitCompleted(userId);

    return this.findOneElearningCompletionById(completion.id);
  }

  /**
   * Delete an elearning completion for a user and unit.
   * @param userId The ID of the user
   * @param unitId The ID of the elearning unit
   * @returns void
   * @throws NotFoundException if the completion does not exist
   */
  async deleteElearningCompletion(userId: string, unitId: string) {
    const completion = await this.elearningCompletionModel.findOne({
      where: { userId, unitId },
    });
    if (!completion) {
      throw new NotFoundException(
        'Completion not found for this user and unit'
      );
    }

    await completion.destroy();
  }

  async allUnitsNotCompletedByUser(user: User): Promise<ElearningUnit[]> {
    const userRole = user.role as UserRole;
    const units = await this.elearningUnitModel.findAll({
      attributes: ELEARNING_UNIT_ATTRIBUTES,
      include: generateElearningUnitIncludes({ userRole, userId: user.id }),
      order: [['order', 'ASC']],
    });
    return units.filter((unit) => {
      const completion = unit.userCompletions?.[0];
      return !completion || !completion.validatedAt;
    });
  }

  // -- PRIVATE METHODS --

  /**
   * This method is called when an elearning unit is completed by a user.
   * @param userId
   */
  private async onElearningUnitCompleted(userId: string) {
    const user = await this.usersService.findOne(userId);

    // If the user is a candidate or coach, we check if they have completed all
    // elearning units and send them a congratulation mail if it's the case
    if (user.role === UserRoles.CANDIDATE || user.role === UserRoles.COACH) {
      this.allUnitsNotCompletedByUser(user)
        .then(async (notCompletedUnits) => {
          const allCompleted = notCompletedUnits.length === 0;
          this.logger.log(
            `User with id ${userId} has completed all elearning units: ${allCompleted}`
          );
          if (allCompleted) {
            if (user) {
              await this.mailsService.sendAllElearningUnitsCompletedMail(user);
            }
          }
        })
        .catch((error) => {
          this.logger.error(
            `Failed to process onElearningUnitCompleted for userId=${userId}`,
            error instanceof Error ? error.stack : undefined
          );
        });
    }
  }
}
