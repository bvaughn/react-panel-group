export function getPanelGroupElement(
  id: string,
  rootElement: ParentNode | HTMLElement = document
): HTMLElement | null {
  //If the root element is the PanelGroup
  if (
    rootElement instanceof HTMLElement &&
    rootElement?.dataset?.panelGroupId == id
  ) {
    return rootElement;
  }

  //Else query children
  const element = rootElement.querySelector(
    `[data-panel-group][data-panel-group-id="${id}"]`
  );
  if (element) {
    return element as HTMLElement;
  }
  return null;
}
