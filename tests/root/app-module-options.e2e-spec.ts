import { randomBytes } from 'crypto';

// Pure unit tests (no database connection is opened): they cover the connection options
// helpers of src/app.module.ts, shared by the API and the worker.
describe('app.module connection options', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    jest.resetModules();
  });

  const loadAppModule = (env: Record<string, string | undefined>) => {
    // app.module builds its Sequelize options when imported: a valid URL is always needed
    process.env.DATABASE_URL = 'postgres://u:p@db.invalid:5432/db';
    Object.entries(env).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    let loaded: typeof import('src/app.module');
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      loaded = require('src/app.module');
    });
    return loaded;
  };

  describe('getSequelizeOptions', () => {
    it('parses DATABASE_URL into the connection options', () => {
      const dbPassword = randomBytes(8).toString('hex');
      const { getSequelizeOptions } = loadAppModule({
        DATABASE_URL: `postgres://some_user:${dbPassword}@db.invalid:6543/some_db`,
      });

      expect(getSequelizeOptions()).toEqual({
        dialect: 'postgres',
        host: 'db.invalid',
        port: 6543,
        username: 'some_user',
        password: dbPassword,
        database: 'some_db',
        autoLoadModels: true,
        logging: false,
        pool: undefined,
      });
    });

    it('passes the pool options through', () => {
      const { getSequelizeOptions } = loadAppModule({
        DATABASE_URL: 'postgres://u:p@db.invalid:5432/db',
      });

      expect(getSequelizeOptions({ max: 10 }).pool).toEqual({ max: 10 });
    });

    it('fails on a malformed DATABASE_URL, as soon as the module is loaded', () => {
      process.env.DATABASE_URL = 'not a url';
      expect(() => {
        jest.isolateModules(() => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('src/app.module');
        });
      }).toThrow();
    });
  });

  describe('getRedisOptions', () => {
    it('returns no option in the test environments', () => {
      const { getRedisOptions } = loadAppModule({ NODE_ENV: 'dev-test' });
      expect(getRedisOptions()).toEqual({});

      const second = loadAppModule({ NODE_ENV: 'test' });
      expect(second.getRedisOptions()).toEqual({});
    });

    it('parses the TLS URL first, with a TLS configuration', () => {
      const redisPassword = randomBytes(8).toString('hex');
      const { getRedisOptions } = loadAppModule({
        NODE_ENV: 'production',
        REDIS_TLS_URL: `rediss://:${redisPassword}@tls.redis.invalid:6380`,
        REDIS_URL: 'redis://plain.redis.invalid:6379',
        DEBUG_JOBS: undefined,
      });

      expect(getRedisOptions()).toEqual({
        port: 6380,
        host: 'tls.redis.invalid',
        password: redisPassword,
        tls: { rejectUnauthorized: false, requestCert: true },
      });
    });

    it('falls back to REDIS_URL, without TLS when jobs are debugged', () => {
      const { getRedisOptions } = loadAppModule({
        NODE_ENV: 'production',
        REDIS_TLS_URL: undefined,
        REDIS_URL: 'redis://plain.redis.invalid:6379',
        DEBUG_JOBS: 'true',
      });

      const options = getRedisOptions();

      expect(options.host).toBe('plain.redis.invalid');
      expect(options.port).toBe(6379);
      expect(options.tls).toBeUndefined();
    });
  });
});
