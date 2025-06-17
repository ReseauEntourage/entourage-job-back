import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Redis from 'ioredis';
import { getRedisOptions } from '../app.module';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const redisClientFactory = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    const options = getRedisOptions();
    const ENV = `${process.env.NODE_ENV}`;

    // Pour les environnements de test, retourner un objet mock ou null
    if (ENV === 'dev-test' || ENV === 'test') {
      return {};
    }

    // Création d'une seule instance Redis partagée
    const client = new Redis({
      port: options.port,
      host: options.host,
      password: options.password,
      tls: options.tls,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      reconnectOnError: (err) => {
        // eslint-disable-next-line no-console
        console.log('Redis reconnection error:', err);
        return true;
      },
    });

    client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    client.on('connect', () => {
      // eslint-disable-next-line no-console
      console.log('Connected to Redis');
    });

    client.on('ready', () => {
      // eslint-disable-next-line no-console
      console.log('Redis client ready');
    });

    client.on('close', () => {
      // eslint-disable-next-line no-console
      console.log('Redis connection closed');
    });

    return client;
  },
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [redisClientFactory],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
