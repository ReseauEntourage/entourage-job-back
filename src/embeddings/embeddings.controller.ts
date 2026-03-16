import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserPermissions, UserPermissionsGuard } from 'src/users/guards';
import { Permissions } from 'src/users/users.types';
import { EmbeddingType } from './embedding.config';
import {
  EmbeddingsRegenerationService,
  RegenerationStats,
} from './embeddings-regeneration.service';

@ApiTags('Embeddings')
@ApiBearerAuth()
@Controller('embeddings')
export class EmbeddingsController {
  constructor(
    private readonly regenerationService: EmbeddingsRegenerationService
  ) {}

  @Post('regenerate')
  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @ApiOperation({
    summary: 'Regenerate outdated embeddings (Admin only)',
    description:
      'Finds users with outdated or missing embeddings and enqueues them for regeneration',
  })
  async regenerateEmbeddings(
    @Query('type') type?: string,
    @Query('dryRun') dryRun?: string,
    @Query('batchSize') batchSize?: string,
    @Query('delay') delay?: string
  ): Promise<RegenerationStats> {
    // Validation des paramètres
    const embeddingType = this.validateEmbeddingType(type);
    const isDryRun = dryRun === 'true';
    const parsedBatchSize = batchSize ? parseInt(batchSize, 10) : undefined;
    const parsedDelay = delay ? parseInt(delay, 10) : undefined;

    if (batchSize && isNaN(parsedBatchSize)) {
      throw new BadRequestException('batchSize must be a valid number');
    }

    if (delay && isNaN(parsedDelay)) {
      throw new BadRequestException('delay must be a valid number');
    }

    if (parsedBatchSize && parsedBatchSize <= 0) {
      throw new BadRequestException('batchSize must be greater than 0');
    }

    if (parsedDelay && parsedDelay < 0) {
      throw new BadRequestException('delay must be 0 or greater');
    }

    return await this.regenerationService.regenerateOutdatedEmbeddings({
      embeddingType,
      dryRun: isDryRun,
      batchSize: parsedBatchSize,
      delayBetweenBatches: parsedDelay,
    });
  }

  private validateEmbeddingType(type?: string): EmbeddingType | 'all' {
    if (!type) {
      return 'all';
    }

    const validTypes = ['profile', 'needs', 'all'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(
        `Invalid embedding type. Must be one of: ${validTypes.join(', ')}`
      );
    }

    return type as EmbeddingType | 'all';
  }
}
