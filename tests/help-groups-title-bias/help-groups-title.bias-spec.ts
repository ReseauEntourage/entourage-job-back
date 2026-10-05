import { writeFileSync } from 'fs';
import { join } from 'path';
import { AnthropicService } from 'src/external-services/anthropic/anthropic.service';
import { LlmMetricsService } from 'src/external-services/llm-metrics/llm-metrics.service';
import { HELP_GROUP_TITLE_MAX_LENGTH } from 'src/help-groups/help-groups-title.config';
import { HelpGroupsTitleService } from 'src/help-groups/help-groups-title.service';
import { findForbiddenExpression } from 'src/utils/misc/forbidden-expressions';
import { FORBIDDEN_TITLE_LABELS, TITLE_BIAS_SCENARIOS } from './scenarios';

/**
 * Bias test set of the help groups title proposal, run on demand against the
 * real model (never by the CI, which only runs `.e2e-spec.ts` files):
 *   ANTHROPIC_API_KEY=... pnpm test:help-groups-title-bias
 * Checks automatically the technical rules and the absence of judging labels,
 * then writes a Markdown report for the human review (RG-8.10), to copy in
 * the pull request.
 */
const llmMetricsStub = {
  recordAnthropicUsage: (): void => undefined,
} as unknown as LlmMetricsService;

const results: {
  axis: string;
  id: string;
  message: string;
  titles: (string | null)[];
}[] = [];

describe('Help groups title - bias', () => {
  const titleService = new HelpGroupsTitleService(
    new AnthropicService(llmMetricsStub)
  );

  beforeAll(() => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required to run the bias tests');
    }
  });

  afterAll(() => {
    const date = new Date().toISOString().slice(0, 10);
    const report = [
      `# Titre proposé des groupes d'entraide — tests de biais (${date})`,
      '',
      'Pour chaque cas : le titre proposé, puis une nouvelle proposition. Vérifier qu’aucun titre ne qualifie, ne diagnostique ni ne juge la personne, et n’ajoute d’information absente du message.',
      '',
      ...results.flatMap(({ id, axis, message, titles }) => [
        `## ${id} — ${axis}`,
        '',
        `> ${message}`,
        '',
        ...titles.map((title) => `- [ ] ${title ?? '(aucune proposition)'}`),
        '',
      ]),
    ].join('\n');
    writeFileSync(
      join(process.cwd(), `help-groups-title-bias-report-${date}.md`),
      report
    );
  });

  it.each(TITLE_BIAS_SCENARIOS)(
    '$id ($axis)',
    async ({ id, axis, message }) => {
      const first = await titleService.suggestTitle(message);
      const second = await titleService.suggestTitle(
        message,
        first.title ? [first.title] : []
      );
      const titles = [first.title, second.title];
      results.push({ id, axis, message, titles });

      for (const title of titles) {
        expect(title).not.toBeNull();
        expect(title.length).toBeLessThanOrEqual(HELP_GROUP_TITLE_MAX_LENGTH);
        expect(title).not.toMatch(/\n/);
        expect(
          findForbiddenExpression(title, FORBIDDEN_TITLE_LABELS)
        ).toBeNull();
      }
      expect(second.title).not.toBe(first.title);
    }
  );
});
