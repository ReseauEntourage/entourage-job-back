import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Redis from 'ioredis';
import { getRedisOptions } from '../app.module';
import { createRedisMock } from 'src/redis/redis.mock';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_OPTIONS = 'REDIS_OPTIONS';

export const createRedisClient = () => {
  const ENV = `${process.env.NODE_ENV}`;

  // Pour les environnements de test, retourner un objet mock approprié
  if (ENV === 'dev-test' || ENV === 'test') {
    return createRedisMock();
  }

  // En production, utiliser les options réelles
  const options = getRedisOptions();

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
};

// Fournisseur pour les options Redis
const redisOptionsProvider = {
  provide: REDIS_OPTIONS,
  useFactory: () => {
    const ENV = `${process.env.NODE_ENV}`;
    if (ENV === 'dev-test' || ENV === 'test') {
      return {};
    }
    return getRedisOptions();
  },
};

// Fournisseur pour le client Redis partagé
const redisClientProvider = {
  provide: REDIS_CLIENT,
  useFactory: () => createRedisClient(),
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [redisOptionsProvider, redisClientProvider],
  exports: [REDIS_OPTIONS, REDIS_CLIENT],
})
export class RedisModule {}
