import {
  aiModelEnvName,
  AiModelUse,
  aiEffortEnvName,
  getAiEffort,
  getAiModel,
} from 'src/external-services/ai-models/ai-models';

// Pure unit tests (no database, no network)
describe('AI models', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    Object.values(AiModelUse).forEach((use) => {
      delete process.env[aiModelEnvName(use)];
      delete process.env[aiEffortEnvName(use)];
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

  it('uses the default model of each usage when no variable is set', () => {
    expect(getAiModel(AiModelUse.CV_EXTRACTION)).toBe('claude-sonnet-5-5');
    expect(getAiModel(AiModelUse.CV_READING)).toBe('claude-sonnet-5-5');
    expect(getAiModel(AiModelUse.CV_BUILDING)).toBe('claude-sonnet-5-5');
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
    process.env.AI_MODEL_CV_BUILDING = 'claude-haiku-5-5';

    expect(getAiModel(AiModelUse.CV_BUILDING)).toBe('claude-haiku-5-5');
    expect(getAiModel(AiModelUse.CV_READING)).toBe('claude-sonnet-5-5');
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
    expect(getAiModel(AiModelUse.CV_READING)).toBe('claude-sonnet-5-5');

    process.env.AI_MODEL_CV_READING = 'claude-haiku-5-5';
    expect(getAiModel(AiModelUse.CV_READING)).toBe('claude-haiku-5-5');

    delete process.env.AI_MODEL_CV_READING;
    expect(getAiModel(AiModelUse.CV_READING)).toBe('claude-sonnet-5-5');
  });

  describe('effort', () => {
    it('has a default for the CV extraction usages only', () => {
      expect(getAiEffort(AiModelUse.CV_EXTRACTION)).toBe('medium');
      expect(getAiEffort(AiModelUse.CV_READING)).toBe('low');
      expect(getAiEffort(AiModelUse.CV_BUILDING)).toBe('low');
      expect(getAiEffort(AiModelUse.AI_ASSISTANT)).toBeUndefined();
      expect(getAiEffort(AiModelUse.HELP_GROUPS_TITLE)).toBeUndefined();
    });

    it('names its variable AI_EFFORT_<USAGE>', () => {
      expect(aiEffortEnvName(AiModelUse.CV_READING)).toBe(
        'AI_EFFORT_CV_READING'
      );
    });

    it('reads the variable of that usage only, at every call', () => {
      process.env.AI_EFFORT_CV_READING = ' high ';

      expect(getAiEffort(AiModelUse.CV_READING)).toBe('high');
      expect(getAiEffort(AiModelUse.CV_BUILDING)).toBe('low');

      process.env.AI_EFFORT_CV_READING = 'medium';
      expect(getAiEffort(AiModelUse.CV_READING)).toBe('medium');
    });

    it('counts an empty or blank value as unset', () => {
      process.env.AI_EFFORT_CV_READING = '';
      process.env.AI_EFFORT_CV_BUILDING = '   ';

      expect(getAiEffort(AiModelUse.CV_READING)).toBe('low');
      expect(getAiEffort(AiModelUse.CV_BUILDING)).toBe('low');
    });
  });
});
