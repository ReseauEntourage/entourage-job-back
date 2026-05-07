import tracer from 'dd-trace';

tracer.init({
  version: process.env.HEROKU_RELEASE_VERSION,
});

tracer.use('pg', {
  service: 'entourage-pro-backend-postgres',
});

export { tracer };
