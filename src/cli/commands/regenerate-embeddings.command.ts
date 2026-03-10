/* eslint-disable no-console */
import { Command, CommandRunner, Option } from 'nest-commander';
import { EmbeddingType } from 'src/embeddings/embedding.config';
import { EmbeddingsRegenerationService } from 'src/embeddings/embeddings-regeneration.service';

interface RegenerateEmbeddingsOptions {
  type?: EmbeddingType | 'all';
  dryRun?: boolean;
  stats?: boolean;
  batchSize?: number;
  delay?: number;
}

@Command({
  name: 'regenerate-embeddings',
  description: 'Regenerate outdated user profile embeddings',
  options: { isDefault: false },
})
export class RegenerateEmbeddingsCommand extends CommandRunner {
  constructor(
    private readonly regenerationService: EmbeddingsRegenerationService
  ) {
    super();
  }

  async run(
    passedParams: string[],
    options?: RegenerateEmbeddingsOptions
  ): Promise<void> {
    try {
      // Show statistics if requested
      if (options?.stats) {
        await this.displayStats();
        return;
      }

      // Run regeneration
      await this.runRegeneration(options);
    } catch (error) {
      console.error('\n❌ Error during regeneration:');
      console.error(error);
      process.exit(1);
    }
  }

  @Option({
    flags: '--type <type>',
    description: 'Type of embeddings to regenerate (profile, needs, all)',
    defaultValue: 'all',
  })
  parseType(val: string): EmbeddingType | 'all' {
    if (val !== 'profile' && val !== 'needs' && val !== 'all') {
      throw new Error(
        `Invalid type: ${val}. Must be one of: profile, needs, all`
      );
    }
    return val;
  }

  @Option({
    flags: '--dry-run',
    description: 'Show what would be done without actually doing it',
  })
  parseDryRun(): boolean {
    return true;
  }

  @Option({
    flags: '--stats',
    description: 'Display statistics about embeddings status',
  })
  parseStats(): boolean {
    return true;
  }

  @Option({
    flags: '--batch-size <size>',
    description: 'Number of users to process per batch',
    defaultValue: '50',
  })
  parseBatchSize(val: string): number {
    const size = parseInt(val, 10);
    if (isNaN(size) || size <= 0) {
      throw new Error('Invalid batch size. Must be a positive number.');
    }
    return size;
  }

  @Option({
    flags: '--delay <ms>',
    description: 'Delay in milliseconds between batches',
    defaultValue: '100',
  })
  parseDelay(val: string): number {
    const delay = parseInt(val, 10);
    if (isNaN(delay) || delay < 0) {
      throw new Error('Invalid delay. Must be a non-negative number.');
    }
    return delay;
  }

  private async displayStats(): Promise<void> {
    console.log('📊 Fetching embeddings statistics...\n');
    const stats = await this.regenerationService.getEmbeddingsStats();

    console.log(
      '╔═══════════════════════════════════════════════════════════╗'
    );
    console.log(
      '║              EMBEDDINGS STATUS REPORT                     ║'
    );
    console.log(
      '╚═══════════════════════════════════════════════════════════╝\n'
    );

    console.log('📋 PROFILE EMBEDDINGS:');
    console.log(`   Total user profiles:     ${stats.profile.total}`);
    console.log(
      `   ✅ Up-to-date:            ${stats.profile.upToDate} (${this.percent(
        stats.profile.upToDate,
        stats.profile.total
      )}%)`
    );
    console.log(
      `   ⚠️  Outdated:              ${stats.profile.outdated} (${this.percent(
        stats.profile.outdated,
        stats.profile.total
      )}%)`
    );
    console.log(
      `   ❌ Missing:               ${stats.profile.missing} (${this.percent(
        stats.profile.missing,
        stats.profile.total
      )}%)`
    );

    console.log('\n📋 NEEDS EMBEDDINGS:');
    console.log(`   Total user profiles:     ${stats.needs.total}`);
    console.log(
      `   ✅ Up-to-date:            ${stats.needs.upToDate} (${this.percent(
        stats.needs.upToDate,
        stats.needs.total
      )}%)`
    );
    console.log(
      `   ⚠️  Outdated:              ${stats.needs.outdated} (${this.percent(
        stats.needs.outdated,
        stats.needs.total
      )}%)`
    );
    console.log(
      `   ❌ Missing:               ${stats.needs.missing} (${this.percent(
        stats.needs.missing,
        stats.needs.total
      )}%)`
    );

    console.log('\n');
  }

  private async runRegeneration(
    options?: RegenerateEmbeddingsOptions
  ): Promise<void> {
    console.log('🔄 Starting embeddings regeneration...\n');

    if (options?.dryRun) {
      console.log('⚠️  DRY RUN MODE - No embeddings will be regenerated\n');
    }

    const stats = await this.regenerationService.regenerateOutdatedEmbeddings({
      embeddingType: options?.type,
      dryRun: options?.dryRun,
      batchSize: options?.batchSize,
      delayBetweenBatches: options?.delay,
    });

    console.log(
      '\n╔═══════════════════════════════════════════════════════════╗'
    );
    console.log(
      '║              REGENERATION COMPLETE                        ║'
    );
    console.log(
      '╚═══════════════════════════════════════════════════════════╝\n'
    );

    console.log('📊 Statistics:');
    console.log(`   Total users identified:  ${stats.totalUsers}`);
    console.log(`   Users enqueued:          ${stats.usersEnqueued}`);
    console.log(`   Errors:                  ${stats.errors}`);

    if (stats.errors > 0) {
      console.log('\n⚠️  Some errors occurred. Check the logs for details.');
    } else if (stats.usersEnqueued > 0) {
      console.log(
        '\n✅ All users have been successfully enqueued for embedding regeneration.'
      );
      console.log(
        '   The embeddings will be processed asynchronously by the worker queue.'
      );
    } else if (stats.totalUsers === 0) {
      console.log('\n✅ All embeddings are up-to-date!');
    }

    console.log('\n');
  }

  private percent(value: number, total: number): string {
    return total === 0 ? '0.0' : ((value / total) * 100).toFixed(1);
  }
}
