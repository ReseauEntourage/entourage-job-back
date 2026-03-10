#!/usr/bin/env node
/**
 * CLI Tool to regenerate outdated user profile embeddings
 *
 * Usage:
 *   npm run regenerate-embeddings -- --type=profile
 *   npm run regenerate-embeddings -- --type=needs
 *   npm run regenerate-embeddings -- --type=all
 *   npm run regenerate-embeddings -- --dry-run
 *   npm run regenerate-embeddings -- --stats
 *
 * Options:
 *   --type=<profile|needs|all>  Type of embeddings to regenerate (default: all)
 *   --dry-run                   Show what would be done without actually doing it
 *   --stats                     Display statistics about embeddings status
 *   --batch-size=<number>       Number of users to process per batch (default: 50)
 *   --delay=<number>            Delay in ms between batches (default: 100)
 *   --help                      Show this help message
 */

/* eslint-disable no-console */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EmbeddingType } from '../embeddings/embedding.config';
import { EmbeddingsRegenerationService } from '../embeddings/embeddings-regeneration.service';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    type?: EmbeddingType | 'all';
    dryRun?: boolean;
    stats?: boolean;
    batchSize?: number;
    delay?: number;
    help?: boolean;
  } = {};

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--stats') {
      options.stats = true;
    } else if (arg.startsWith('--type=')) {
      const type = arg.split('=')[1];
      if (type === 'profile' || type === 'needs' || type === 'all') {
        options.type = type;
      } else {
        console.error(
          `Invalid type: ${type}. Must be one of: profile, needs, all`
        );
        process.exit(1);
      }
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1], 10);
      if (isNaN(options.batchSize) || options.batchSize <= 0) {
        console.error('Invalid batch size. Must be a positive number.');
        process.exit(1);
      }
    } else if (arg.startsWith('--delay=')) {
      options.delay = parseInt(arg.split('=')[1], 10);
      if (isNaN(options.delay) || options.delay < 0) {
        console.error('Invalid delay. Must be a non-negative number.');
        process.exit(1);
      }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║              Embeddings Regeneration CLI Tool                     ║
╚═══════════════════════════════════════════════════════════════════╝

DESCRIPTION:
  Regenerate outdated user profile embeddings based on configVersion.
  
USAGE:
  npm run regenerate-embeddings -- [options]

OPTIONS:
  --type=<profile|needs|all>  Type of embeddings to regenerate
                              (default: all)
                              
  --dry-run                   Show what would be done without actually
                              enqueuing any jobs
                              
  --stats                     Display statistics about current embeddings
                              status without regenerating
                              
  --batch-size=<number>       Number of users to process per batch
                              (default: 50)
                              
  --delay=<number>            Delay in milliseconds between batches
                              (default: 100)
                              
  --help, -h                  Show this help message

EXAMPLES:
  # Show statistics only
  npm run regenerate-embeddings -- --stats
  
  # Dry run to see what would be regenerated
  npm run regenerate-embeddings -- --dry-run
  
  # Regenerate only profile embeddings
  npm run regenerate-embeddings -- --type=profile
  
  # Regenerate all embeddings with custom batch size
  npm run regenerate-embeddings -- --batch-size=100 --delay=200
  
  # Regenerate needs embeddings (dry run)
  npm run regenerate-embeddings -- --type=needs --dry-run
  `);
}

async function bootstrap() {
  const options = parseArgs();

  // Show help if requested
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log('🚀 Initializing NestJS application...\n');

  // Create NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const regenerationService = app.get(EmbeddingsRegenerationService);

    // Show statistics if requested
    if (options.stats) {
      console.log('📊 Fetching embeddings statistics...\n');
      const stats = await regenerationService.getEmbeddingsStats();

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
        `   ✅ Up-to-date:            ${stats.profile.upToDate} (${(
          (stats.profile.upToDate / stats.profile.total) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `   ⚠️  Outdated:              ${stats.profile.outdated} (${(
          (stats.profile.outdated / stats.profile.total) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `   ❌ Missing:               ${stats.profile.missing} (${(
          (stats.profile.missing / stats.profile.total) *
          100
        ).toFixed(1)}%)`
      );

      console.log('\n📋 NEEDS EMBEDDINGS:');
      console.log(`   Total user profiles:     ${stats.needs.total}`);
      console.log(
        `   ✅ Up-to-date:            ${stats.needs.upToDate} (${(
          (stats.needs.upToDate / stats.needs.total) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `   ⚠️  Outdated:              ${stats.needs.outdated} (${(
          (stats.needs.outdated / stats.needs.total) *
          100
        ).toFixed(1)}%)`
      );
      console.log(
        `   ❌ Missing:               ${stats.needs.missing} (${(
          (stats.needs.missing / stats.needs.total) *
          100
        ).toFixed(1)}%)`
      );

      console.log('\n');
      await app.close();
      process.exit(0);
    }

    // Run regeneration
    console.log('🔄 Starting embeddings regeneration...\n');

    if (options.dryRun) {
      console.log('⚠️  DRY RUN MODE - No embeddings will be regenerated\n');
    }

    const stats = await regenerationService.regenerateOutdatedEmbeddings({
      embeddingType: options.type,
      dryRun: options.dryRun,
      batchSize: options.batchSize,
      delayBetweenBatches: options.delay,
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

    console.log(`📊 Statistics:`);
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
  } catch (error) {
    console.error('\n❌ Error during regeneration:');
    console.error(error);
    await app.close();
    process.exit(1);
  }

  await app.close();
  process.exit(0);
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the CLI
bootstrap();
