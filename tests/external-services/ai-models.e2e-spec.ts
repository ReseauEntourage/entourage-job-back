import {
  aiModelEnvName,
  AiModelUse,
  getAiModel,
} from 'src/external-services/ai-models/ai-models';

// Pure unit tests (no database, no network)
describe('AI models', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    Object.values(AiModelUse).forEach((use) => {
      delete process.env[aiModelEnvName(use)];
    });
  });

  afterAll(() => {
    process.env = { ...envBackup };
  });

  it('has one variable per usage, named AI_MODEL_<USAGE>', () => {
    expect(Object.values(AiModelUse).map(aiModelEnvName).sort()).toEqual(
      [
        'AI_MODEL_CV_EXTRACTION',
        'AI_MODEL_CV_READING',
        'AI_MODEL_CV_BUILDING',
        'AI_MODEL_AI_ASSISTANT',
        'AI_MODEL_AI_ASSISTANT_CLASSIFIER',
        'AI_MODEL_PRESENTATION_GENERATION',
        'AI_MODEL_HELP_GROUPS_TITLE',
      ].sort()
    );
  });

  it('keeps the model used before the setting when no variable is set', () => {
    expect(getAiModel(AiModelUse.CV_EXTRACTION)).toBe('o4-mini-2025-04-16');
    expect(getAiModel(AiModelUse.CV_READING)).toBe('o4-mini-2025-04-16');
    expect(getAiModel(AiModelUse.CV_BUILDING)).toBe('o4-mini-2025-04-16');
    expect(getAiModel(AiModelUse.AI_ASSISTANT)).toBe('claude-sonnet-4-6');
    expect(getAiModel(AiModelUse.AI_ASSISTANT_CLASSIFIER)).toBe(
      'claude-haiku-4-5-20251001'
    );
    expect(getAiModel(AiModelUse.PRESENTATION_GENERATION)).toBe(
      'claude-haiku-4-5-20251001'
    );
    expect(getAiModel(AiModelUse.HELP_GROUPS_TITLE)).toBe(
      'claude-haiku-4-5-20251001'
    );
  });

  it('uses the model of the variable, for that usage only', () => {
    process.env.AI_MODEL_CV_BUILDING = 'gpt-4.1-mini';

    expect(getAiModel(AiModelUse.CV_BUILDING)).toBe('gpt-4.1-mini');
    expect(getAiModel(AiModelUse.CV_READING)).toBe('o4-mini-2025-04-16');
    expect(getAiModel(AiModelUse.HELP_GROUPS_TITLE)).toBe(
      'claude-haiku-4-5-20251001'
    );
  });

  it.each([[''], ['   '], ['\n']])(
    'counts the blank value %p as not set',
    (blank) => {
      process.env.AI_MODEL_AI_ASSISTANT = blank;

      expect(getAiModel(AiModelUse.AI_ASSISTANT)).toBe('claude-sonnet-4-6');
    }
  );

  it('trims the value of the variable', () => {
    process.env.AI_MODEL_AI_ASSISTANT = '  claude-sonnet-5-5 ';

    expect(getAiModel(AiModelUse.AI_ASSISTANT)).toBe('claude-sonnet-5-5');
  });

  it('reads the variable at every call, without caching it', () => {
    expect(getAiModel(AiModelUse.CV_READING)).toBe('o4-mini-2025-04-16');

    process.env.AI_MODEL_CV_READING = 'gpt-4.1-mini';
    expect(getAiModel(AiModelUse.CV_READING)).toBe('gpt-4.1-mini');

    delete process.env.AI_MODEL_CV_READING;
    expect(getAiModel(AiModelUse.CV_READING)).toBe('o4-mini-2025-04-16');
  });
});
