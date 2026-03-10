#!/usr/bin/env node
import { CommandFactory } from 'nest-commander';
import { CliModule } from './cli.module';

async function bootstrap() {
  try {
    const app = await CommandFactory.createWithoutRunning(CliModule, {
      logger: ['error', 'warn', 'log'],
    });

    await app.init();

    try {
      await CommandFactory.runApplication(app);
      await app.close();
      process.exit(0);
    } catch (err) {
      await app.close();
      throw err;
    }
  } catch (error) {
    console.error('Error running command:', error);
    process.exit(1);
  }
}

bootstrap();
