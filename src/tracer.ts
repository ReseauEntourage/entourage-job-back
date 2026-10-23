import tracer from 'dd-trace';

tracer.init({
  version: process.env.HEROKU_RELEASE_VERSION,
  clientIpEnabled: true,
});

tracer.use('pg', {
  service: 'entourage-pro-backend-postgres',
});

// OpenAI is only used by the CV extraction, which traces its LLM call by hand
// (the automatic span turns the CV page images into an `[image]` marker). Only
// the LLM Observability half of the integration is switched off: the APM
// tracing of the HTTP call stays.
tracer.use('openai', { llmobs: false });

export { tracer };
