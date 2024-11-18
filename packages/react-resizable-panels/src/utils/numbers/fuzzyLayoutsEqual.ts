import { fuzzyNumbersEqual } from "./fuzzyNumbersEqual";

export function fuzzyLayoutsEqual(
  actual: number[],
  expected: number[],
  fractionDigits?: number
): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  for (let index = 0; index < actual.length; index++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const actualSize = actual[index]!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const expectedSize = expected[index]!;

    if (!fuzzyNumbersEqual(actualSize, expectedSize, fractionDigits)) {
      return false;
    }
  }

  return true;
}
