import {
  aiModelEnvName,
  AiModelUse,
  aiReasoningEffortEnvName,
  getAiModel,
  getReasoningEffort,
} from 'src/external-services/ai-models/ai-models';

// Pure unit tests (no database, no network)
describe('AI models', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    Object.values(AiModelUse).forEach((use) => {
      delete process.env[aiModelEnvName(use)];
      delete process.env[aiReasoningEffortEnvName(use)];
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
    expect(getAiModel(AiModelUse.CV_EXTRACTION)).toBe('gpt-5-mini');
    expect(getAiModel(AiModelUse.CV_READING)).toBe('gpt-5-mini');
    expect(getAiModel(AiModelUse.CV_BUILDING)).toBe('gpt-5-mini');
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
    expect(getAiModel(AiModelUse.CV_READING)).toBe('gpt-5-mini');
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
    expect(getAiModel(AiModelUse.CV_READING)).toBe('gpt-5-mini');

    process.env.AI_MODEL_CV_READING = 'gpt-4.1-mini';
    expect(getAiModel(AiModelUse.CV_READING)).toBe('gpt-4.1-mini');

    delete process.env.AI_MODEL_CV_READING;
    expect(getAiModel(AiModelUse.CV_READING)).toBe('gpt-5-mini');
  });

  describe('reasoning effort', () => {
    it('is undefined when no variable is set', () => {
      Object.values(AiModelUse).forEach((use) => {
        expect(getReasoningEffort(use)).toBeUndefined();
      });
    });

    it('names its variable AI_REASONING_EFFORT_<USAGE>', () => {
      expect(aiReasoningEffortEnvName(AiModelUse.CV_READING)).toBe(
        'AI_REASONING_EFFORT_CV_READING'
      );
    });

    it('reads the variable of that usage only, at every call', () => {
      process.env.AI_REASONING_EFFORT_CV_READING = ' low ';

      expect(getReasoningEffort(AiModelUse.CV_READING)).toBe('low');
      expect(getReasoningEffort(AiModelUse.CV_BUILDING)).toBeUndefined();

      process.env.AI_REASONING_EFFORT_CV_READING = 'high';
      expect(getReasoningEffort(AiModelUse.CV_READING)).toBe('high');
    });

    it('counts an empty or blank value as unset', () => {
      process.env.AI_REASONING_EFFORT_CV_READING = '';
      process.env.AI_REASONING_EFFORT_CV_BUILDING = '   ';

      expect(getReasoningEffort(AiModelUse.CV_READING)).toBeUndefined();
      expect(getReasoningEffort(AiModelUse.CV_BUILDING)).toBeUndefined();
    });
  });
});
