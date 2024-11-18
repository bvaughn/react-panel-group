import { DragState, ResizeEvent } from "../PanelGroupContext";
import { Direction } from "../types";
import { assert } from "./assert";
import { getPanelGroupElement } from "./dom/getPanelGroupElement";
import { getResizeHandleElement } from "./dom/getResizeHandleElement";
import { getResizeEventCursorPosition } from "./events/getResizeEventCursorPosition";

export function calculateDragOffsetPercentage(
  event: ResizeEvent,
  dragHandleId: string,
  direction: Direction,
  initialDragState: DragState,
  panelGroupElement: HTMLElement
): number {
  const isHorizontal = direction === "horizontal";

  const handleElement = getResizeHandleElement(dragHandleId, panelGroupElement);
  assert(
    handleElement,
    `No resize handle element found for id "${dragHandleId}"`
  );

  const groupId = handleElement.getAttribute("data-panel-group-id");
  assert(groupId, `Resize handle element has no group id attribute`);

  const { initialCursorPosition } = initialDragState;

  const cursorPosition = getResizeEventCursorPosition(direction, event);

  const groupElement = getPanelGroupElement(groupId, panelGroupElement);
  assert(groupElement, `No group element found for id "${groupId}"`);

  const groupRect = groupElement.getBoundingClientRect();
  const groupSizeInPixels = isHorizontal ? groupRect.width : groupRect.height;

  const offsetPixels = cursorPosition - initialCursorPosition;
  const offsetPercentage = (offsetPixels / groupSizeInPixels) * 100;

  return offsetPercentage;
}
