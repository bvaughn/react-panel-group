export function getResizeHandleElement(id: string): HTMLElement | null {
  const element = document.querySelector(
    `[data-panel-resize-handle-id="${id}"]`
  );
  if (element) {
    return element as HTMLElement;
  }
  return null;
}
