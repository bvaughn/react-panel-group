import { expect, Page, test } from "@playwright/test";
import { createElement } from "react";
import {
  assert,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

import { PanelResizeLogEntry } from "../src/routes/examples/types";

import { clearLogEntries, getLogEntries } from "./utils/debug";
import { imperativeResizePanelGroup } from "./utils/panels";
import { goToUrl, updateUrl } from "./utils/url";

function createElements(numPanels: 2 | 3) {
  const panels = [
    createElement(Panel, {
      collapsible: true,
      defaultSize: numPanels === 3 ? 20 : 40,
      id: "left",
      minSize: 10,
      order: 1,
    }),
    createElement(PanelResizeHandle, { id: "left-handle" }),
    createElement(Panel, {
      defaultSize: 60,
      id: "middle",
      minSize: 10,
      order: 2,
    }),
  ];

  if (numPanels === 3) {
    panels.push(
      createElement(PanelResizeHandle, { id: "right-handle" }),
      createElement(Panel, {
        collapsible: true,
        defaultSize: 20,
        id: "right",
        minSize: 10,
        order: 3,
      })
    );
  }

  return createElement(
    PanelGroup,
    { direction: "horizontal", id: "group" },
    ...panels
  );
}

async function openPage(page: Page) {
  const panelGroup = createElements(3);

  await goToUrl(page, panelGroup);
}

async function verifyEntries(
  page: Page,
  expectedLogEntries: Array<{ panelId: string; size: number }>
) {
  const logEntries = await getLogEntries<PanelResizeLogEntry>(page, "onResize");

  expect(logEntries.length).toEqual(expectedLogEntries.length);

  for (let index = 0; index < expectedLogEntries.length; index++) {
    const actualLogEntry = logEntries[index];
    assert(actualLogEntry);
    const { panelId: actualPanelId, size: actualSize } = actualLogEntry;

    const expectedLogEntry = expectedLogEntries[index];
    assert(expectedLogEntry);
    const { panelId: expectedPanelId, size: expectedPanelSize } =
      expectedLogEntry;

    expect(actualPanelId).toEqual(expectedPanelId);
    expect(actualSize).toEqual(expectedPanelSize);
  }
}

test.describe("Panel onResize prop", () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  test("should be called once on-mount", async ({ page }) => {
    await verifyEntries(page, [
      { panelId: "left", size: 20 },
      { panelId: "middle", size: 60 },
      { panelId: "right", size: 20 },
    ]);
  });

  test("should be called when panels are resized", async ({ page }) => {
    const leftHandle = page.locator(
      '[data-panel-resize-handle-id="left-handle"]'
    );
    const rightHandle = page.locator(
      '[data-panel-resize-handle-id="right-handle"]'
    );

    await clearLogEntries(page);

    await leftHandle.focus();
    await page.keyboard.press("Home");
    await verifyEntries(page, [
      { panelId: "left", size: 0 },
      { panelId: "middle", size: 80 },
    ]);

    await clearLogEntries(page);

    await rightHandle.focus();
    await page.keyboard.press("End");
    await verifyEntries(page, [
      { panelId: "middle", size: 100 },
      { panelId: "right", size: 0 },
    ]);

    await clearLogEntries(page);

    await page.keyboard.press("ArrowLeft");
    await verifyEntries(page, [
      { panelId: "middle", size: 90 },
      { panelId: "right", size: 10 },
    ]);
  });

  test("should be called when triggering PanelGroup setLayout method", async ({
    page,
  }) => {
    await clearLogEntries(page);

    await imperativeResizePanelGroup(page, "group", ["10%", "20%", "70%"]);

    await verifyEntries(page, [
      { panelId: "left", size: 10 },
      { panelId: "middle", size: 20 },
      { panelId: "right", size: 70 },
    ]);
  });

  test("should be called when a panel is added or removed from the group", async ({
    page,
  }) => {
    await verifyEntries(page, [
      { panelId: "left", size: 20 },
      { panelId: "middle", size: 60 },
      { panelId: "right", size: 20 },
    ]);

    await clearLogEntries(page);

    await updateUrl(page, createElements(2));
    await verifyEntries(page, [{ panelId: "left", size: 40 }]);

    await clearLogEntries(page);

    await updateUrl(page, createElements(3));
    await verifyEntries(page, [
      { panelId: "left", size: 20 },
      { panelId: "right", size: 20 },
    ]);
  });
});
