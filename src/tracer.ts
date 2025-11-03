import tracer from 'dd-trace';

const ENV = `${process.env.NODE_ENV}`;

if (ENV === 'production') {
  tracer.init({
    version: process.env.HEROKU_RELEASE_VERSION,
    plugins: {
      express: {
        enabled: true,
        blacklist: ['/queues/*', '@bull-board/express'],
      },
    },
  } as unknown);

  tracer.use('pg', {
    service: 'linkedout-backend-postgres',
  });
}

export { tracer };
