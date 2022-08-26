import { Diff, diff } from 'deep-diff';
import * as jsdiff from 'diff';
import * as _ from 'lodash';
import { AnyCantFix, HistorizedModel } from 'src/utils/types';
import { Revision, RevisionChange } from './models';

const exclude = [
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'created_at',
  'updated_at',
  'deleted_at',
  'revision',
];

function calcDelta(
  current: Partial<HistorizedModel>,
  next: Partial<HistorizedModel>,
  exclude: string[],
  strict: boolean
): Array<Diff<Partial<HistorizedModel>, Partial<HistorizedModel>>> {
  const di = diff(current, next);

  let diffs = [];
  if (di) {
    diffs = di
      .map((i) => JSON.parse(JSON.stringify(i).replace('"__data",', '')))
      .filter((i) => {
        if (!strict && i.kind === 'E') {
          if (i.lhs != i.rhs) return i;
        } else return i;
        return false;
      })
      .filter((i) => exclude.every((x) => i.path.indexOf(x) === -1));
  }

  if (diffs.length > 0) {
    return diffs;
  }
  return null;
}

const diffToString = (val: AnyCantFix) => {
  if (typeof val === 'undefined' || val === null) {
    return '';
  }
  if (val === true) {
    return '1';
  }
  if (val === false) {
    return '0';
  }
  if (typeof val === 'string') {
    return val;
  }
  if (!Number.isNaN(Number(val))) {
    return `${String(val)}`;
  }
  if ((typeof val === 'undefined' ? 'undefined' : typeof val) === 'object') {
    return `${JSON.stringify(val)}`;
  }
  if (Array.isArray(val)) {
    return `${JSON.stringify(val)}`;
  }
  return '';
};

type Operation = 'update' | 'create' | 'destroy';
type HookInstance = HistorizedModel & {
  context?: { delta?: Array<Diff<AnyCantFix>> };
};

export async function createBeforeHook(
  instance: HookInstance,
  operation: Operation
): Promise<void> {
  const destroyOperation = operation === 'destroy';
  const updateOperation = operation === 'update';

  let previousVersion: Partial<HistorizedModel> = instance.previous();
  let currentVersion: Partial<HistorizedModel> = instance.toJSON();

  // Supported nested models.
  previousVersion = _.omitBy(
    previousVersion,
    (i) => i != null && typeof i === 'object' && !(i instanceof Date)
  );
  previousVersion = _.omit(previousVersion, exclude);

  currentVersion = _.omitBy(
    currentVersion,
    (i) => i != null && typeof i === 'object' && !(i instanceof Date)
  );
  currentVersion = _.omit(currentVersion, exclude);

  if (updateOperation) {
    currentVersion = _.pick(currentVersion, Object.keys(previousVersion));
  }

  // Disallow change of revision
  instance.set('revision', instance.previous('revision'));

  // Get diffs
  const delta = calcDelta(previousVersion, currentVersion, exclude, true);

  const currentRevisionId: number = instance.get('revision') as number;

  if (currentRevisionId !== 0 && !currentRevisionId && updateOperation) {
    throw new Error('Revision Id was undefined');
  }

  if (destroyOperation || (delta && delta.length > 0)) {
    const revisionId = (currentRevisionId || 0) + 1;
    instance.set('revision', revisionId);

    if (!instance.context) {
      instance.context = {};
    }
    instance.context.delta = delta;
  }
}

export async function createAfterHook(
  instance: HookInstance,
  operation: Operation
): Promise<void> {
  const destroyOperation = operation === 'destroy';

  if (
    instance.context &&
    ((instance.context.delta && instance.context.delta.length > 0) ||
      destroyOperation)
  ) {
    const { delta } = instance.context;

    let currentVersion: Partial<HistorizedModel> = instance.toJSON();

    currentVersion = _.omitBy(
      currentVersion,
      (i) => i != null && typeof i === 'object' && !(i instanceof Date)
    );
    currentVersion = _.omit(currentVersion, exclude);

    let document = currentVersion;

    // Build revision
    const query = {
      model: instance.constructor.name,
      document,
      operation,
    } as Partial<Revision>;

    query['documentId'] = instance.id;

    const revision = Revision.build(query);

    revision['revision'] = instance.get('revision') as number;

    try {
      // Save revision
      const objectRevision = await revision.save();

      // Loop diffs and create a revision-diff for each
      _.forEach(
        delta,
        async (
          difference: Diff<
            Partial<HistorizedModel>,
            Partial<HistorizedModel>
          > & {
            lhs?: Partial<HistorizedModel>;
            rhs?: Partial<HistorizedModel>;
          }
        ) => {
          const o = diffToString(difference.lhs);
          const n = diffToString(difference.rhs);

          document = difference as Partial<HistorizedModel>;
          const diff = o || n ? jsdiff.diffChars(o, n) : [];

          const d = RevisionChange.build({
            path: difference.path[0],
            document,
            diff,
            revisionId: objectRevision.id,
          });

          const savedD = await d.save();
          await objectRevision.$add(`revisionsChanges`, savedD);

          return null;
        }
      );

      return;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
  return;
}
