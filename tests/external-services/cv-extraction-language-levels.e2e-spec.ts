import {
  CV_BUILDING_SYSTEM_PROMPT,
  CV_EXTRACTION_SYSTEM_PROMPT,
} from 'src/external-services/cv-extraction/cv-extraction.config';
import { cvSchema } from 'src/external-services/cv-extraction/cv-extraction.schemas';
import { CvExtractionService } from 'src/external-services/cv-extraction/cv-extraction.service';

// The model is mocked: these tests check what the model is told, not how it
// answers. The behaviour itself is checked on the traces after deployment.
describe('CvExtractionService - language levels', () => {
  const anthropic = { createMessageUntraced: jest.fn() };
  const llmMetrics = { recordAnthropicUsage: jest.fn() };

  const level = cvSchema.properties.languages.items.properties.level;
  const description = level.description;

  // Splits the description in its two parts: the test scores, then the scale
  const [scores, scale] = description.split('Sans score ni diplôme');

  beforeEach(() => {
    anthropic.createMessageUntraced.mockReset();
    anthropic.createMessageUntraced.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{}' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  });

  it('keeps the four levels the application accepts', () => {
    expect(level.enum).toEqual(['NOTIONS', 'INTERMEDIATE', 'FLUENT', 'NATIVE']);
    expect(cvSchema.properties.languages.items.properties.name.type).toBe(
      'string'
    );
    expect(cvSchema.properties.languages.items.required).toEqual([
      'name',
      'value',
    ]);
  });

  it('sends the level description to the model', async () => {
    const service = new CvExtractionService(
      anthropic as never,
      llmMetrics as never
    );

    await service.extractCVFromImages(['p']);

    const schema = JSON.stringify(
      anthropic.createMessageUntraced.mock.calls[0][0].output_config.format
        .schema
    );
    expect(schema).toContain('« langue maternelle »');
    expect(schema).toContain('TOEIC Listening & Reading 941 et plus');
  });

  it('reserves NATIVE for an explicit mother tongue, "Français : langue maternelle"', () => {
    expect(scale).toContain(
      "NATIVE uniquement si le CV dit expressément que c'est la langue maternelle"
    );
    expect(scale).toContain('« langue maternelle »');
    expect(scale).toContain('« native speaker »');
    expect(scale).toContain('« mother tongue »');
    expect(scale).toContain('« bilingue » ne veut pas dire langue maternelle');
  });

  it('puts "bilingue" among the FLUENT keywords, "Anglais bilingue"', () => {
    const fluent = scale.slice(
      scale.indexOf('FLUENT :'),
      scale.indexOf('INTERMEDIATE :')
    );
    for (const keyword of [
      'bilingue',
      'bilingual',
      'courant',
      'couramment',
      'fluent',
      'maîtrise',
      'excellent',
      'professionnel complet',
      'C1-C2',
    ]) {
      expect(fluent).toContain(keyword);
    }
  });

  it('lists the INTERMEDIATE and NOTIONS keywords, "Espagnol : notions"', () => {
    const intermediate = scale.slice(
      scale.indexOf('INTERMEDIATE :'),
      scale.indexOf('NOTIONS :')
    );
    for (const keyword of [
      'intermédiaire',
      'bon niveau',
      'conversationnel',
      'good command',
      'B1-B2',
    ]) {
      expect(intermediate).toContain(keyword);
    }
    const notions = scale.slice(scale.indexOf('NOTIONS :'));
    for (const keyword of [
      'notions',
      'débutant',
      'bases',
      'scolaire',
      'élémentaire',
      'basic',
      'beginner',
      'A1-A2',
    ]) {
      expect(notions).toContain(keyword);
    }
  });

  it('gives the thresholds of the language tests, "TOEIC 975"', () => {
    expect(scores).toContain('TOEIC Listening & Reading 941 et plus = FLUENT');
    expect(scores).toContain('550 à 940 = INTERMEDIATE');
    expect(scores).toContain('moins de 550 = NOTIONS');
    expect(scores).toContain('IELTS 7.0 et plus = FLUENT');
    expect(scores).toContain('5.0 à 6.5 = INTERMEDIATE');
    expect(scores).toContain('moins de 5.0 = NOTIONS');
    expect(scores).toContain('TOEFL iBT 95 et plus = FLUENT');
    expect(scores).toContain('42 à 94 = INTERMEDIATE');
    expect(scores).toContain('moins de 42 = NOTIONS');
    expect(scores).toContain('DELF, DALF, Cambridge');
    expect(scores).toContain('niveau CECRL du diplôme');
  });

  it('lets a test score win over an ambiguous wording', () => {
    expect(scores).toContain('prime sur toute formulation ambiguë');
    expect(scores).toContain('« compétence professionnelle »');
    expect(scores).toContain('« opérationnel »');
    expect(scores).toContain('« très bon niveau »');
    // The wording that caused the TOEIC 975 mistake is no longer an INTERMEDIATE keyword
    expect(scale).not.toContain('INTERMEDIATE (intermédiaire, opérationnel');
  });

  it('asks not to fill a level the CV does not give', () => {
    expect(description).toContain(
      "Ne pas remplir si aucun niveau, score ou diplôme n'est précisé"
    );
  });

  it.each([
    ['single-call extraction', CV_EXTRACTION_SYSTEM_PROMPT],
    ['building pass', CV_BUILDING_SYSTEM_PROMPT],
  ])('repeats the language rules in the %s prompt', (_name, prompt) => {
    expect(prompt).toContain('un score de test de langue');
    expect(prompt).toContain("N'invente jamais une langue ni un niveau");
    expect(prompt).toContain('rédigé dans cette langue');
  });
});
