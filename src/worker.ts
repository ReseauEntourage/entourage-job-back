import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerModule);
  // await app.listen(process.env.WORKER_PORT || process.env.PORT || 3001);
}

bootstrap();
