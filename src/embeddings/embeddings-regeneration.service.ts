import { Injectable, Logger } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { EMBEDDING_CONFIG, EmbeddingType } from './embedding.config';

export interface RegenerationStats {
  totalUsers: number;
  usersEnqueued: number;
  errors: number;
  dryRun: boolean;
}

export interface RegenerationOptions {
  embeddingType?: EmbeddingType | 'all';
  dryRun?: boolean;
  batchSize?: number;
  delayBetweenBatches?: number;
}

@Injectable()
export class EmbeddingsRegenerationService {
  private readonly logger = new Logger(EmbeddingsRegenerationService.name);
  private readonly DEFAULT_BATCH_SIZE = 50;
  private readonly DEFAULT_DELAY_MS = 100;

  constructor(
    private sequelize: Sequelize,
    private queuesService: QueuesService
  ) {}

  /**
   * Identifie tous les utilisateurs dont les embeddings sont obsolètes ou manquants
   * @param embeddingType Type d'embedding à vérifier ('profile', 'needs', ou 'all')
   * @returns Liste des userIds concernés
   */
  async findUsersWithOutdatedEmbeddings(
    embeddingType: EmbeddingType | 'all' = 'all'
  ): Promise<string[]> {
    const typesToCheck: EmbeddingType[] =
      embeddingType === 'all' ? ['profile', 'needs'] : [embeddingType];

    const userIdsSet = new Set<string>();

    for (const type of typesToCheck) {
      const targetVersion = EMBEDDING_CONFIG[type].version;

      // Requête pour trouver les utilisateurs avec embeddings obsolètes ou manquants
      const query = `
        SELECT DISTINCT up."userId"
        FROM "UserProfiles" up
        LEFT JOIN "UserProfileEmbeddings" upe 
          ON upe."userProfileId" = up.id 
          AND upe.type = :type
        LEFT JOIN "Users" u
          ON u.id = up."userId"
        WHERE
          (
            -- Embeddings obsolètes (version différente)
            (upe."configVersion" IS NOT NULL AND upe."configVersion" != :targetVersion)
            OR
            -- Embeddings manquants
            (upe.id IS NULL)
          )
          AND u."deletedAt" IS NULL
      `;

      const results = await this.sequelize.query<{ userId: string }>(query, {
        replacements: { type, targetVersion },
        type: QueryTypes.SELECT,
      });

      results.forEach((row) => userIdsSet.add(row.userId));
    }

    return Array.from(userIdsSet);
  }

  /**
   * Régénère les embeddings pour tous les utilisateurs concernés
   * @param options Options de régénération
   * @returns Statistiques de régénération
   */
  async regenerateOutdatedEmbeddings(
    options: RegenerationOptions = {}
  ): Promise<RegenerationStats> {
    const {
      embeddingType = 'all',
      dryRun = false,
      batchSize = this.DEFAULT_BATCH_SIZE,
      delayBetweenBatches = this.DEFAULT_DELAY_MS,
    } = options;

    this.logger.log('Starting embeddings regeneration...');
    this.logger.log(`Options: ${JSON.stringify(options)}`);

    // Trouver tous les utilisateurs concernés
    const userIds = await this.findUsersWithOutdatedEmbeddings(embeddingType);

    if (userIds.length === 0) {
      this.logger.log('No users with outdated embeddings found.');
      return {
        totalUsers: 0,
        usersEnqueued: 0,
        errors: 0,
        dryRun,
      };
    }

    this.logger.log(
      `Found ${userIds.length} users with outdated embeddings for type: ${embeddingType}`
    );

    if (dryRun) {
      this.logger.log('[DRY RUN] Would enqueue these users:');
      userIds.slice(0, 10).forEach((userId) => {
        this.logger.log(`  - ${userId}`);
      });
      if (userIds.length > 10) {
        this.logger.log(`  ... and ${userIds.length - 10} more`);
      }
      return {
        totalUsers: userIds.length,
        usersEnqueued: 0,
        errors: 0,
        dryRun,
      };
    }

    // Traiter par lots
    const stats: RegenerationStats = {
      totalUsers: userIds.length,
      usersEnqueued: 0,
      errors: 0,
      dryRun,
    };

    const embeddingTypes: EmbeddingType[] =
      embeddingType === 'all' ? ['profile', 'needs'] : [embeddingType];

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      this.logger.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          userIds.length / batchSize
        )} (${batch.length} users)...`
      );

      for (const userId of batch) {
        try {
          await this.queuesService.addToEmbeddingQueue(
            Jobs.UPDATE_USER_PROFILE_EMBEDDINGS,
            {
              userId,
              embeddingTypes,
            }
          );
          stats.usersEnqueued++;
        } catch (error) {
          this.logger.error(
            `Failed to enqueue user ${userId}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          stats.errors++;
        }
      }

      // Pause entre les lots pour éviter de surcharger la queue
      if (i + batchSize < userIds.length) {
        await this.delay(delayBetweenBatches);
      }
    }

    this.logger.log('Regeneration completed!');
    this.logger.log(`Total users found: ${stats.totalUsers}`);
    this.logger.log(`Users enqueued: ${stats.usersEnqueued}`);
    this.logger.log(`Errors: ${stats.errors}`);

    return stats;
  }

  /**
   * Obtient des statistiques sur l'état des embeddings
   * @returns Statistiques détaillées par type d'embedding
   */
  async getEmbeddingsStats(): Promise<{
    profile: {
      total: number;
      upToDate: number;
      outdated: number;
      missing: number;
    };
    needs: {
      total: number;
      upToDate: number;
      outdated: number;
      missing: number;
    };
  }> {
    const profileStats = await this.getStatsForType('profile');
    const needsStats = await this.getStatsForType('needs');

    return {
      profile: profileStats,
      needs: needsStats,
    };
  }

  private async getStatsForType(type: EmbeddingType) {
    const targetVersion = EMBEDDING_CONFIG[type].version;

    const query = `
      SELECT 
        COUNT(DISTINCT up.id) as total,
        COUNT(DISTINCT CASE 
          WHEN upe."configVersion" = :targetVersion THEN up.id 
        END) as up_to_date,
        COUNT(DISTINCT CASE 
          WHEN upe."configVersion" IS NOT NULL AND upe."configVersion" != :targetVersion THEN up.id 
        END) as outdated,
        COUNT(DISTINCT CASE 
          WHEN upe.id IS NULL THEN up.id 
        END) as missing
      FROM "UserProfiles" up
      LEFT JOIN "UserProfileEmbeddings" upe 
        ON upe."userProfileId" = up.id 
        AND upe.type = :type
      LEFT JOIN "Users" u
        ON u.id = up."userId"
      WHERE u."deletedAt" IS NULL
    `;

    const [result] = await this.sequelize.query<{
      total: string;
      up_to_date: string;
      outdated: string;
      missing: string;
    }>(query, {
      replacements: { type, targetVersion },
      type: QueryTypes.SELECT,
    });

    return {
      total: parseInt(result.total),
      upToDate: parseInt(result.up_to_date),
      outdated: parseInt(result.outdated),
      missing: parseInt(result.missing),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
