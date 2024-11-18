export function assert(
  expectedCondition: unknown,
  message: string
): asserts expectedCondition {
  if (!expectedCondition) {
    console.error(message);

    throw Error(message);
  }
}
