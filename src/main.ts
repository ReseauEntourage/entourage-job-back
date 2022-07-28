import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SpelunkerModule } from 'nestjs-spelunker';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: `${process.env.FRONT_URL}` });
  const tree = SpelunkerModule.explore(app);
  const root = SpelunkerModule.graph(tree);
  const edges = SpelunkerModule.findGraphEdges(root);
  const mermaidEdges = edges.map(
    ({ from, to }) => `${from.module.name}-->${to.module.name}`
  );
  console.log(mermaidEdges.join('\n'));
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
