import './tracer';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(new LoggingInterceptor());

  if (process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Entourage Pro API')
      .setDescription(
        "Webapp de recrutement pour le processus de réinsertion des personnes en manque de réseau professionnel. L'objectif est de guider et accompagner le candidat tout au long du parcours de recherche et du recrutement."
      )
      .setVersion('2.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  app.enableCors();
  /*
  {
    origin: [
      `${process.env.FRONT_URL}`,
      /\.webflow\.io$/,
      /\.entourage\.social$/,
      /\.entourage-pro\.fr$/,
    ],
  }
  */
  await app.listen(process.env.PORT || 3000);
}

bootstrap();
