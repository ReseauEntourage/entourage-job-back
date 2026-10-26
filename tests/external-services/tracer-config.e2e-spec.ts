// Pure unit test (no database, no network): `dd-trace` is replaced by a double.
const mockInit = jest.fn();
const mockUse = jest.fn();
jest.mock('dd-trace', () => ({
  __esModule: true,
  default: { init: mockInit, use: mockUse },
}));

describe('tracer', () => {
  it('keeps the automatic LLM Observability spans of the LLM integrations', async () => {
    await import('src/tracer');

    // The Anthropic calls that are traced by hand (the CV extraction) go
    // through the client's generic `post`, which the integration does not wrap:
    // the integration stays on for every other call (assistant, titles,
    // presentation).
    expect(mockUse).not.toHaveBeenCalledWith('anthropic', expect.anything());
  });

  it('keeps the APM integrations it already configured', async () => {
    await import('src/tracer');

    expect(mockInit).toHaveBeenCalled();
    expect(mockUse).toHaveBeenCalledWith('pg', {
      service: 'entourage-pro-backend-postgres',
    });
  });
});
