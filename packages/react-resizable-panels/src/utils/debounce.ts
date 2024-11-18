// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function debounce<T extends (...args: any[]) => void>(
  callback: T,
  durationMs = 10
) {
  let timeoutId: NodeJS.Timeout | null = null;

  function callable(...args: unknown[]) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      callback(...args);
    }, durationMs);
  }

  return callable as unknown as T;
}
