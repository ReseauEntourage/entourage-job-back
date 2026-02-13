export type DetailsCounts = {
  total: number;
  success: number;
  failure: number;
};

export type SettledFailure = { itemId: string | number; reason: unknown };

export function collectSettledResults<T extends { id?: string | number }>(
  items: T[],
  results: Array<PromiseSettledResult<unknown>>,
  onFailure: (itemId: string | number, reason: unknown) => void
): {
  successIds: Array<string | number>;
  failures: SettledFailure[];
  succeeded: boolean;
} {
  const successIds: Array<string | number> = [];
  const failures: SettledFailure[] = [];

  results.forEach((result, index) => {
    const rawItemId = items[index]?.id;
    const itemId = rawItemId ?? `unknown-${index}`;

    if (result.status === 'fulfilled') {
      successIds.push(itemId);
      return;
    }

    failures.push({ itemId, reason: result.reason });
    onFailure(itemId, result.reason);
  });

  return { successIds, failures, succeeded: failures.length === 0 };
}
