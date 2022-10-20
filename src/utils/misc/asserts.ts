import { AnyCantFix } from 'src/utils/types';

function throwAssertionError(
  val: AnyCantFix,
  type: string,
  additionalMessage = ''
) {
  throw new Error(
    `
      Assertion error: expected 'val' to be ${type}, but received ${val}
      ${additionalMessage && `\n\n${additionalMessage}`}
    `
  );
}

export function assertIsString(
  val: AnyCantFix,
  message = ''
): asserts val is string {
  if (typeof val !== 'string') {
    throwAssertionError(val, 'string', message);
  }
}

export function assertIsNumber(
  val: AnyCantFix,
  message = ''
): asserts val is number {
  if (typeof val !== 'number') {
    throwAssertionError(val, 'number', message);
  }
}

export function assertIsBoolean(
  val: AnyCantFix,
  message = ''
): asserts val is boolean {
  if (typeof val !== 'boolean') {
    throwAssertionError(val, 'boolean', message);
  }
}

export function assertIsDefined<T>(
  val: T,
  message = ''
): asserts val is NonNullable<T> {
  if (val === undefined || val === null) {
    throwAssertionError(val, 'defined', message);
  }
}

export function assertCondition(
  condition: boolean,
  message = ''
): asserts condition {
  if (!condition) {
    throwAssertionError(condition, 'condition', message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function assertUnreachable(x: never) {
  throw new Error("Didn't expect to get here");
}
