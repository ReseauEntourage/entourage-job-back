// Pure unit test (no database, no network): `dd-trace` is replaced by a double.
const mockInit = jest.fn();
const mockUse = jest.fn();
jest.mock('dd-trace', () => ({
  __esModule: true,
  default: { init: mockInit, use: mockUse },
}));

describe('tracer', () => {
  it('switches off the LLM Observability half of the OpenAI integration only', async () => {
    await import('src/tracer');

    // The manual LLM span of the CV extraction replaces the automatic one,
    // which turns images into an `[image]` marker. `llmobs: false` keeps the
    // APM tracing of the HTTP call (checked against the real dd-trace 6.16:
    // one automatic LLM span without it, none with it).
    expect(mockUse).toHaveBeenCalledWith('openai', { llmobs: false });
  });

  it('keeps the APM integrations it already configured', async () => {
    await import('src/tracer');

    expect(mockInit).toHaveBeenCalled();
    expect(mockUse).toHaveBeenCalledWith('pg', {
      service: 'entourage-pro-backend-postgres',
    });
  });
});
