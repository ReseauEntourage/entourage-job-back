import './tracer';

import { getHeapStatistics } from 'v8';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('LinkedOut Backend')
      .setDescription('LinkedOut API description')
      .setVersion('2.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  app.enableCors({ origin: `${process.env.FRONT_URL}` });
  await app.listen(process.env.PORT || 3000);

  // eslint-disable-next-line no-console
  console.log('MEMORY USAGE');
  // eslint-disable-next-line no-console
  console.log(getHeapStatistics());
}
bootstrap();
