const util = require("util");

export function verifyExpectedWarnings(
  callback: Function,
  ...expectedMessages: string[]
) {
  const consoleSpy = (format: any, ...args: any[]) => {
    const message = util.format(format, ...args);

    for (let index = 0; index < expectedMessages.length; index++) {
      const expectedMessage = expectedMessages[index];
      if (message.includes(expectedMessage)) {
        expectedMessages.splice(index, 1);
        return;
      }
    }

    if (expectedMessages.length === 0) {
      throw new Error(`Unexpected message recorded:\n\n${message}`);
    }
  };

  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = consoleSpy;
  console.warn = consoleSpy;

  let caughtError;
  let didCatch = false;
  try {
    callback();
  } catch (error) {
    caughtError = error;
    didCatch = true;
  } finally {
    console.error = originalError;
    console.warn = originalWarn;

    if (didCatch) {
      throw caughtError;
    }

    // Any remaining messages indicate a failed expectations.
    if (expectedMessages.length > 0) {
      throw Error(
        `Expected message(s) not recorded:\n\n${expectedMessages.join("\n")}`
      );
    }

    return { pass: true };
  }
}