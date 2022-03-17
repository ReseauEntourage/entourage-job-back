import { NestFactory } from '@nestjs/core';
import { QueuesModule } from './queues/producers/queues.module';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule);
  await app.listen(process.env.PORT || 3001);
}

bootstrap();
