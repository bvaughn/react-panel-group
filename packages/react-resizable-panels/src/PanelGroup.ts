import { isDevelopment } from "#is-development";
import { PanelConstraints, PanelData } from "./Panel";
import {
  DragState,
  PanelGroupContext,
  ResizeEvent,
  TPanelGroupContext,
} from "./PanelGroupContext";
import {
  EXCEEDED_HORIZONTAL_MAX,
  EXCEEDED_HORIZONTAL_MIN,
  EXCEEDED_VERTICAL_MAX,
  EXCEEDED_VERTICAL_MIN,
  reportConstraintsViolation,
} from "./PanelResizeHandleRegistry";
import { useForceUpdate } from "./hooks/useForceUpdate";
import useIsomorphicLayoutEffect from "./hooks/useIsomorphicEffect";
import useUniqueId from "./hooks/useUniqueId";
import { useWindowSplitterPanelGroupBehavior } from "./hooks/useWindowSplitterPanelGroupBehavior";
import { Direction } from "./types";
import { adjustLayoutByDelta } from "./utils/adjustLayoutByDelta";
import { areEqual } from "./utils/arrays";
import { assert } from "./utils/assert";
import { calculateDeltaPercentage } from "./utils/calculateDeltaPercentage";
import { calculateUnsafeDefaultLayout } from "./utils/calculateUnsafeDefaultLayout";
import { callPanelCallbacks } from "./utils/callPanelCallbacks";
import { compareLayouts } from "./utils/compareLayouts";
import { computePanelFlexBoxStyle } from "./utils/computePanelFlexBoxStyle";
import debounce from "./utils/debounce";
import { determinePivotIndices } from "./utils/determinePivotIndices";
import { getResizeHandleElement } from "./utils/dom/getResizeHandleElement";
import { isKeyDown, isMouseEvent, isPointerEvent } from "./utils/events";
import { getResizeEventCursorPosition } from "./utils/events/getResizeEventCursorPosition";
import { initializeDefaultStorage } from "./utils/initializeDefaultStorage";
import {
  fuzzyCompareNumbers,
  fuzzyNumbersEqual,
} from "./utils/numbers/fuzzyCompareNumbers";
import {
  loadPanelGroupState,
  savePanelGroupState,
} from "./utils/serialization";
import { validatePanelConstraints } from "./utils/validatePanelConstraints";
import { validatePanelGroupLayout } from "./utils/validatePanelGroupLayout";
import {
  CSSProperties,
  ForwardedRef,
  HTMLAttributes,
  PropsWithChildren,
  ReactElement,
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "./vendor/react";

const LOCAL_STORAGE_DEBOUNCE_INTERVAL = 100;

export type ImperativePanelGroupHandle = {
  getId: () => string;
  getLayout: () => number[];
  setLayout: (layout: number[]) => void;
};

export type PanelGroupStorage = {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
};

export type PanelGroupOnLayout = (layout: number[]) => void;

const defaultStorage: PanelGroupStorage = {
  getItem: (name: string) => {
    initializeDefaultStorage(defaultStorage);
    return defaultStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    initializeDefaultStorage(defaultStorage);
    defaultStorage.setItem(name, value);
  },
};

export type PanelGroupProps = Omit<
  HTMLAttributes<keyof HTMLElementTagNameMap>,
  "id"
> &
  PropsWithChildren<{
    autoSaveId?: string | null;
    className?: string;
    direction: Direction;
    id?: string | null;
    keyboardResizeBy?: number | null;
    onLayout?: PanelGroupOnLayout | null;
    storage?: PanelGroupStorage;
    style?: CSSProperties;
    tagName?: keyof HTMLElementTagNameMap;

    // Better TypeScript hinting
    dir?: "auto" | "ltr" | "rtl" | undefined;
  }>;

const debounceMap: Record<string, typeof savePanelGroupState> = {};

function PanelGroupWithForwardedRef({
  autoSaveId = null,
  children,
  className: classNameFromProps = "",
  direction,
  forwardedRef,
  id: idFromProps = null,
  onLayout = null,
  keyboardResizeBy = null,
  storage = defaultStorage,
  style: styleFromProps,
  tagName: Type = "div",
  ...rest
}: PanelGroupProps & {
  forwardedRef: ForwardedRef<ImperativePanelGroupHandle>;
}): ReactElement {
  const groupId = useUniqueId(idFromProps);
  const panelGroupElementRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [layout, setLayout] = useState<number[]>([]);
  const forceUpdate = useForceUpdate();

  const panelIdToLastNotifiedSizeMapRef = useRef<Record<string, number>>({});
  const panelSizeBeforeCollapseRef = useRef<Map<string, number>>(new Map());
  const prevDeltaRef = useRef<number>(0);

  const committedValuesRef = useRef<{
    autoSaveId: string | null;
    direction: Direction;
    dragState: DragState | null;
    id: string;
    keyboardResizeBy: number | null;
    onLayout: PanelGroupOnLayout | null;
    storage: PanelGroupStorage;
  }>({
    autoSaveId,
    direction,
    dragState,
    id: groupId,
    keyboardResizeBy,
    onLayout,
    storage,
  });

  const eagerValuesRef = useRef<{
    layout: number[];
    panelDataArray: PanelData[];
    panelDataArrayChanged: boolean;
  }>({
    layout,
    panelDataArray: [],
    panelDataArrayChanged: false,
  });

  const devWarningsRef = useRef<{
    didLogIdAndOrderWarning: boolean;
    didLogPanelConstraintsWarning: boolean;
    prevPanelIds: string[];
  }>({
    didLogIdAndOrderWarning: false,
    didLogPanelConstraintsWarning: false,
    prevPanelIds: [],
  });

  useImperativeHandle(
    forwardedRef,
    () => ({
      getId: () => committedValuesRef.current.id,
      getLayout: () => {
        const { layout } = eagerValuesRef.current;

        return layout;
      },
      setLayout: (unsafeLayout: number[]) => {
        const { onLayout } = committedValuesRef.current;
        const { layout: prevLayout, panelDataArray } = eagerValuesRef.current;

        const safeLayout = validatePanelGroupLayout({
          layout: unsafeLayout,
          panelConstraints: panelDataArray.map(
            (panelData) => panelData.constraints
          ),
        });

        if (!areEqual(prevLayout, safeLayout)) {
          setLayout(safeLayout);

          eagerValuesRef.current.layout = safeLayout;

          if (onLayout) {
            onLayout(safeLayout);
          }

          callPanelCallbacks(
            panelDataArray,
            safeLayout,
            panelIdToLastNotifiedSizeMapRef.current
          );
        }
      },
    }),
    []
  );

  useIsomorphicLayoutEffect(() => {
    committedValuesRef.current.autoSaveId = autoSaveId;
    committedValuesRef.current.direction = direction;
    committedValuesRef.current.dragState = dragState;
    committedValuesRef.current.id = groupId;
    committedValuesRef.current.onLayout = onLayout;
    committedValuesRef.current.storage = storage;
  });

  useWindowSplitterPanelGroupBehavior({
    committedValuesRef,
    eagerValuesRef,
    groupId,
    layout,
    panelDataArray: eagerValuesRef.current.panelDataArray,
    setLayout,
    panelGroupElement: panelGroupElementRef.current,
  });

  useEffect(() => {
    const { panelDataArray } = eagerValuesRef.current;

    // If this panel has been configured to persist sizing information, save sizes to local storage.
    if (autoSaveId) {
      if (layout.length === 0 || layout.length !== panelDataArray.length) {
        return;
      }

      let debouncedSave = debounceMap[autoSaveId];

      // Limit the frequency of localStorage updates.
      if (debouncedSave == null) {
        debouncedSave = debounce(
          savePanelGroupState,
          LOCAL_STORAGE_DEBOUNCE_INTERVAL
        );

        debounceMap[autoSaveId] = debouncedSave;
      }

      // Clone mutable data before passing to the debounced function,
      // else we run the risk of saving an incorrect combination of mutable and immutable values to state.
      const clonedPanelDataArray = [...panelDataArray];
      const clonedPanelSizesBeforeCollapse = new Map(
        panelSizeBeforeCollapseRef.current
      );
      debouncedSave(
        autoSaveId,
        clonedPanelDataArray,
        clonedPanelSizesBeforeCollapse,
        layout,
        storage
      );
    }
  }, [autoSaveId, layout, storage]);

  // DEV warnings
  useEffect(() => {
    if (isDevelopment) {
      const { panelDataArray } = eagerValuesRef.current;

      const {
        didLogIdAndOrderWarning,
        didLogPanelConstraintsWarning,
        prevPanelIds,
      } = devWarningsRef.current;

      if (!didLogIdAndOrderWarning) {
        const panelIds = panelDataArray.map(({ id }) => id);

        devWarningsRef.current.prevPanelIds = panelIds;

        const panelsHaveChanged =
          prevPanelIds.length > 0 && !areEqual(prevPanelIds, panelIds);
        if (panelsHaveChanged) {
          if (
            panelDataArray.find(
              ({ idIsFromProps, order }) => !idIsFromProps || order == null
            )
          ) {
            devWarningsRef.current.didLogIdAndOrderWarning = true;

            console.warn(
              `WARNING: Panel id and order props recommended when panels are dynamically rendered`
            );
          }
        }
      }

      if (!didLogPanelConstraintsWarning) {
        const panelConstraints = panelDataArray.map(
          (panelData) => panelData.constraints
        );

        for (
          let panelIndex = 0;
          panelIndex < panelConstraints.length;
          panelIndex++
        ) {
          const panelData = panelDataArray[panelIndex];
          assert(panelData, `Panel data not found for index ${panelIndex}`);

          const isValid = validatePanelConstraints({
            panelConstraints,
            panelId: panelData.id,
            panelIndex,
          });

          if (!isValid) {
            devWarningsRef.current.didLogPanelConstraintsWarning = true;

            break;
          }
        }
      }
    }
  });

  // External APIs are safe to memoize via committed values ref
  const collapsePanel = useCallback((panelData: PanelData) => {
    const { onLayout } = committedValuesRef.current;
    const { layout: prevLayout, panelDataArray } = eagerValuesRef.current;

    if (panelData.constraints.collapsible) {
      const panelConstraintsArray = panelDataArray.map(
        (panelData) => panelData.constraints
      );

      const {
        collapsedSize = 0,
        panelSize,
        pivotIndices,
      } = panelDataHelper(panelDataArray, panelData, prevLayout);

      assert(
        panelSize != null,
        `Panel size not found for panel "${panelData.id}"`
      );

      if (!fuzzyNumbersEqual(panelSize, collapsedSize)) {
        // Store size before collapse;
        // This is the size that gets restored if the expand() API is used.
        panelSizeBeforeCollapseRef.current.set(panelData.id, panelSize);

        const isLastPanel =
          findPanelDataIndex(panelDataArray, panelData) ===
          panelDataArray.length - 1;
        const delta = isLastPanel
          ? panelSize - collapsedSize
          : collapsedSize - panelSize;

        const nextLayout = adjustLayoutByDelta({
          delta,
          initialLayout: prevLayout,
          panelConstraints: panelConstraintsArray,
          pivotIndices,
          prevLayout,
          trigger: "imperative-api",
        });

        if (!compareLayouts(prevLayout, nextLayout)) {
          setLayout(nextLayout);

          eagerValuesRef.current.layout = nextLayout;

          if (onLayout) {
            onLayout(nextLayout);
          }

          callPanelCallbacks(
            panelDataArray,
            nextLayout,
            panelIdToLastNotifiedSizeMapRef.current
          );
        }
      }
    }
  }, []);

  // External APIs are safe to memoize via committed values ref
  const expandPanel = useCallback(
    (panelData: PanelData, minSizeOverride?: number) => {
      const { onLayout } = committedValuesRef.current;
      const { layout: prevLayout, panelDataArray } = eagerValuesRef.current;

      if (panelData.constraints.collapsible) {
        const panelConstraintsArray = panelDataArray.map(
          (panelData) => panelData.constraints
        );

        const {
          collapsedSize = 0,
          panelSize = 0,
          minSize: minSizeFromProps = 0,
          pivotIndices,
        } = panelDataHelper(panelDataArray, panelData, prevLayout);

        const minSize = minSizeOverride ?? minSizeFromProps;

        if (fuzzyNumbersEqual(panelSize, collapsedSize)) {
          // Restore this panel to the size it was before it was collapsed, if possible.
          const prevPanelSize = panelSizeBeforeCollapseRef.current.get(
            panelData.id
          );

          const baseSize =
            prevPanelSize != null && prevPanelSize >= minSize
              ? prevPanelSize
              : minSize;

          const isLastPanel =
            findPanelDataIndex(panelDataArray, panelData) ===
            panelDataArray.length - 1;
          const delta = isLastPanel
            ? panelSize - baseSize
            : baseSize - panelSize;

          const nextLayout = adjustLayoutByDelta({
            delta,
            initialLayout: prevLayout,
            panelConstraints: panelConstraintsArray,
            pivotIndices,
            prevLayout,
            trigger: "imperative-api",
          });

          if (!compareLayouts(prevLayout, nextLayout)) {
            setLayout(nextLayout);

            eagerValuesRef.current.layout = nextLayout;

            if (onLayout) {
              onLayout(nextLayout);
            }

            callPanelCallbacks(
              panelDataArray,
              nextLayout,
              panelIdToLastNotifiedSizeMapRef.current
            );
          }
        }
      }
    },
    []
  );

  // External APIs are safe to memoize via committed values ref
  const getPanelSize = useCallback((panelData: PanelData) => {
    const { layout, panelDataArray } = eagerValuesRef.current;

    const { panelSize } = panelDataHelper(panelDataArray, panelData, layout);

    assert(
      panelSize != null,
      `Panel size not found for panel "${panelData.id}"`
    );

    return panelSize;
  }, []);

  // This API should never read from committedValuesRef
  const getPanelStyle = useCallback(
    (panelData: PanelData, defaultSize: number | undefined) => {
      const { panelDataArray } = eagerValuesRef.current;

      const panelIndex = findPanelDataIndex(panelDataArray, panelData);

      return computePanelFlexBoxStyle({
        defaultSize,
        dragState,
        layout,
        panelData: panelDataArray,
        panelIndex,
      });
    },
    [dragState, layout]
  );

  // External APIs are safe to memoize via committed values ref
  const isPanelCollapsed = useCallback((panelData: PanelData) => {
    const { layout, panelDataArray } = eagerValuesRef.current;

    const {
      collapsedSize = 0,
      collapsible,
      panelSize,
    } = panelDataHelper(panelDataArray, panelData, layout);

    assert(
      panelSize != null,
      `Panel size not found for panel "${panelData.id}"`
    );

    return collapsible === true && fuzzyNumbersEqual(panelSize, collapsedSize);
  }, []);

  // External APIs are safe to memoize via committed values ref
  const isPanelExpanded = useCallback((panelData: PanelData) => {
    const { layout, panelDataArray } = eagerValuesRef.current;

    const {
      collapsedSize = 0,
      collapsible,
      panelSize,
    } = panelDataHelper(panelDataArray, panelData, layout);

    assert(
      panelSize != null,
      `Panel size not found for panel "${panelData.id}"`
    );

    return !collapsible || fuzzyCompareNumbers(panelSize, collapsedSize) > 0;
  }, []);

  const registerPanel = useCallback(
    (panelData: PanelData) => {
      const { panelDataArray } = eagerValuesRef.current;

      panelDataArray.push(panelData);
      panelDataArray.sort((panelA, panelB) => {
        const orderA = panelA.order;
        const orderB = panelB.order;
        if (orderA == null && orderB == null) {
          return 0;
        } else if (orderA == null) {
          return -1;
        } else if (orderB == null) {
          return 1;
        } else {
          return orderA - orderB;
        }
      });

      eagerValuesRef.current.panelDataArrayChanged = true;

      forceUpdate();
    },
    [forceUpdate]
  );

  // (Re)calculate group layout whenever panels are registered or unregistered.
  useIsomorphicLayoutEffect(() => {
    if (eagerValuesRef.current.panelDataArrayChanged) {
      eagerValuesRef.current.panelDataArrayChanged = false;

      const { autoSaveId, onLayout, storage } = committedValuesRef.current;
      const { layout: prevLayout, panelDataArray } = eagerValuesRef.current;

      // If this panel has been configured to persist sizing information,
      // default size should be restored from local storage if possible.
      let unsafeLayout: number[] | null = null;
      if (autoSaveId) {
        const state = loadPanelGroupState(autoSaveId, panelDataArray, storage);
        if (state) {
          panelSizeBeforeCollapseRef.current = new Map(
            Object.entries(state.expandToSizes)
          );
          unsafeLayout = state.layout;
        }
      }

      if (unsafeLayout == null) {
        unsafeLayout = calculateUnsafeDefaultLayout({
          panelDataArray,
        });
      }

      // Validate even saved layouts in case something has changed since last render
      // e.g. for pixel groups, this could be the size of the window
      const nextLayout = validatePanelGroupLayout({
        layout: unsafeLayout,
        panelConstraints: panelDataArray.map(
          (panelData) => panelData.constraints
        ),
      });

      if (!areEqual(prevLayout, nextLayout)) {
        setLayout(nextLayout);

        eagerValuesRef.current.layout = nextLayout;

        if (onLayout) {
          onLayout(nextLayout);
        }

        callPanelCallbacks(
          panelDataArray,
          nextLayout,
          panelIdToLastNotifiedSizeMapRef.current
        );
      }
    }
  });

  // Reset the cached layout if hidden by the Activity/Offscreen API
  useIsomorphicLayoutEffect(() => {
    const eagerValues = eagerValuesRef.current;
    return () => {
      eagerValues.layout = [];
    };
  }, []);

  const registerResizeHandle = useCallback((dragHandleId: string) => {
    let isRTL = false;

    const panelGroupElement = panelGroupElementRef.current;
    if (panelGroupElement) {
      const style = window.getComputedStyle(panelGroupElement, null);
      if (style.getPropertyValue("direction") === "rtl") {
        isRTL = true;
      }
    }

    return function resizeHandler(event: ResizeEvent) {
      event.preventDefault();

      const panelGroupElement = panelGroupElementRef.current;
      if (!panelGroupElement) {
        return () => null;
      }

      const {
        direction,
        dragState,
        id: groupId,
        keyboardResizeBy,
        onLayout,
      } = committedValuesRef.current;
      const { layout: prevLayout, panelDataArray } = eagerValuesRef.current;

      const { initialLayout } = dragState ?? {};

      const pivotIndices = determinePivotIndices(
        groupId,
        dragHandleId,
        panelGroupElement
      );

      let delta = calculateDeltaPercentage(
        event,
        dragHandleId,
        direction,
        dragState,
        keyboardResizeBy,
        panelGroupElement
      );

      const isHorizontal = direction === "horizontal";

      if (isHorizontal && isRTL) {
        delta = -delta;
      }

      const panelConstraints = panelDataArray.map(
        (panelData) => panelData.constraints
      );

      const nextLayout = adjustLayoutByDelta({
        delta,
        initialLayout: initialLayout ?? prevLayout,
        panelConstraints,
        pivotIndices,
        prevLayout,
        trigger: isKeyDown(event) ? "keyboard" : "mouse-or-touch",
      });

      const layoutChanged = !compareLayouts(prevLayout, nextLayout);

      // Only update the cursor for layout changes triggered by touch/mouse events (not keyboard)
      // Update the cursor even if the layout hasn't changed (we may need to show an invalid cursor state)
      if (isPointerEvent(event) || isMouseEvent(event)) {
        // Watch for multiple subsequent deltas; this might occur for tiny cursor movements.
        // In this case, Panel sizes might not change–
        // but updating cursor in this scenario would cause a flicker.
        if (prevDeltaRef.current != delta) {
          prevDeltaRef.current = delta;

          if (!layoutChanged && delta !== 0) {
            // If the pointer has moved too far to resize the panel any further, note this so we can update the cursor.
            // This mimics VS Code behavior.
            if (isHorizontal) {
              reportConstraintsViolation(
                dragHandleId,
                delta < 0 ? EXCEEDED_HORIZONTAL_MIN : EXCEEDED_HORIZONTAL_MAX
              );
            } else {
              reportConstraintsViolation(
                dragHandleId,
                delta < 0 ? EXCEEDED_VERTICAL_MIN : EXCEEDED_VERTICAL_MAX
              );
            }
          } else {
            reportConstraintsViolation(dragHandleId, 0);
          }
        }
      }

      if (layoutChanged) {
        setLayout(nextLayout);

        eagerValuesRef.current.layout = nextLayout;

        if (onLayout) {
          onLayout(nextLayout);
        }

        callPanelCallbacks(
          panelDataArray,
          nextLayout,
          panelIdToLastNotifiedSizeMapRef.current
        );
      }
    };
  }, []);

  // External APIs are safe to memoize via committed values ref
  const resizePanel = useCallback(
    (panelData: PanelData, unsafePanelSize: number) => {
      const { onLayout } = committedValuesRef.current;

      const { layout: prevLayout, panelDataArray } = eagerValuesRef.current;

      const panelConstraintsArray = panelDataArray.map(
        (panelData) => panelData.constraints
      );

      const { panelSize, pivotIndices } = panelDataHelper(
        panelDataArray,
        panelData,
        prevLayout
      );

      assert(
        panelSize != null,
        `Panel size not found for panel "${panelData.id}"`
      );

      const isLastPanel =
        findPanelDataIndex(panelDataArray, panelData) ===
        panelDataArray.length - 1;
      const delta = isLastPanel
        ? panelSize - unsafePanelSize
        : unsafePanelSize - panelSize;

      const nextLayout = adjustLayoutByDelta({
        delta,
        initialLayout: prevLayout,
        panelConstraints: panelConstraintsArray,
        pivotIndices,
        prevLayout,
        trigger: "imperative-api",
      });

      if (!compareLayouts(prevLayout, nextLayout)) {
        setLayout(nextLayout);

        eagerValuesRef.current.layout = nextLayout;

        if (onLayout) {
          onLayout(nextLayout);
        }

        callPanelCallbacks(
          panelDataArray,
          nextLayout,
          panelIdToLastNotifiedSizeMapRef.current
        );
      }
    },
    []
  );

  const reevaluatePanelConstraints = useCallback(
    (panelData: PanelData, prevConstraints: PanelConstraints) => {
      const { layout, panelDataArray } = eagerValuesRef.current;

      const {
        collapsedSize: prevCollapsedSize = 0,
        collapsible: prevCollapsible,
      } = prevConstraints;

      const {
        collapsedSize: nextCollapsedSize = 0,
        collapsible: nextCollapsible,
        maxSize: nextMaxSize = 100,
        minSize: nextMinSize = 0,
      } = panelData.constraints;

      const { panelSize: prevPanelSize } = panelDataHelper(
        panelDataArray,
        panelData,
        layout
      );
      if (prevPanelSize == null) {
        // It's possible that the panels in this group have changed since the last render
        return;
      }

      if (
        prevCollapsible &&
        nextCollapsible &&
        fuzzyNumbersEqual(prevPanelSize, prevCollapsedSize)
      ) {
        if (!fuzzyNumbersEqual(prevCollapsedSize, nextCollapsedSize)) {
          resizePanel(panelData, nextCollapsedSize);
        } else {
          // Stay collapsed
        }
      } else if (prevPanelSize < nextMinSize) {
        resizePanel(panelData, nextMinSize);
      } else if (prevPanelSize > nextMaxSize) {
        resizePanel(panelData, nextMaxSize);
      }
    },
    [resizePanel]
  );

  // TODO Multiple drag handles can be active at the same time so this API is a bit awkward now
  const startDragging = useCallback(
    (dragHandleId: string, event: ResizeEvent) => {
      const { direction } = committedValuesRef.current;
      const { layout } = eagerValuesRef.current;
      if (!panelGroupElementRef.current) {
        return;
      }
      const handleElement = getResizeHandleElement(
        dragHandleId,
        panelGroupElementRef.current
      );
      assert(
        handleElement,
        `Drag handle element not found for id "${dragHandleId}"`
      );

      const initialCursorPosition = getResizeEventCursorPosition(
        direction,
        event
      );

      setDragState({
        dragHandleId,
        dragHandleRect: handleElement.getBoundingClientRect(),
        initialCursorPosition,
        initialLayout: layout,
      });
    },
    []
  );

  const stopDragging = useCallback(() => {
    setDragState(null);
  }, []);

  const unregisterPanel = useCallback(
    (panelData: PanelData) => {
      const { panelDataArray } = eagerValuesRef.current;

      const index = findPanelDataIndex(panelDataArray, panelData);
      if (index >= 0) {
        panelDataArray.splice(index, 1);

        // TRICKY
        // When a panel is removed from the group, we should delete the most recent prev-size entry for it.
        // If we don't do this, then a conditionally rendered panel might not call onResize when it's re-mounted.
        // Strict effects mode makes this tricky though because all panels will be registered, unregistered, then re-registered on mount.
        delete panelIdToLastNotifiedSizeMapRef.current[panelData.id];

        eagerValuesRef.current.panelDataArrayChanged = true;

        forceUpdate();
      }
    },
    [forceUpdate]
  );

  const context = useMemo(
    () =>
      ({
        collapsePanel,
        direction,
        dragState,
        expandPanel,
        getPanelSize,
        getPanelStyle,
        groupId,
        isPanelCollapsed,
        isPanelExpanded,
        reevaluatePanelConstraints,
        registerPanel,
        registerResizeHandle,
        resizePanel,
        startDragging,
        stopDragging,
        unregisterPanel,
        panelGroupElement: panelGroupElementRef.current,
      }) satisfies TPanelGroupContext,
    [
      collapsePanel,
      dragState,
      direction,
      expandPanel,
      getPanelSize,
      getPanelStyle,
      groupId,
      isPanelCollapsed,
      isPanelExpanded,
      reevaluatePanelConstraints,
      registerPanel,
      registerResizeHandle,
      resizePanel,
      startDragging,
      stopDragging,
      unregisterPanel,
    ]
  );

  const style: CSSProperties = {
    display: "flex",
    flexDirection: direction === "horizontal" ? "row" : "column",
    height: "100%",
    overflow: "hidden",
    width: "100%",
  };

  return createElement(
    PanelGroupContext.Provider,
    { value: context },
    createElement(Type, {
      ...rest,

      children,
      className: classNameFromProps,
      id: idFromProps,
      ref: panelGroupElementRef,
      style: {
        ...style,
        ...styleFromProps,
      },

      // CSS selectors
      "data-panel-group": "",
      "data-panel-group-direction": direction,
      "data-panel-group-id": groupId,
    })
  );
}

export const PanelGroup = forwardRef<
  ImperativePanelGroupHandle,
  PanelGroupProps
>((props: PanelGroupProps, ref: ForwardedRef<ImperativePanelGroupHandle>) =>
  createElement(PanelGroupWithForwardedRef, { ...props, forwardedRef: ref })
);

PanelGroupWithForwardedRef.displayName = "PanelGroup";
PanelGroup.displayName = "forwardRef(PanelGroup)";

function findPanelDataIndex(panelDataArray: PanelData[], panelData: PanelData) {
  return panelDataArray.findIndex(
    (prevPanelData) =>
      prevPanelData === panelData || prevPanelData.id === panelData.id
  );
}

function panelDataHelper(
  panelDataArray: PanelData[],
  panelData: PanelData,
  layout: number[]
) {
  const panelIndex = findPanelDataIndex(panelDataArray, panelData);

  const isLastPanel = panelIndex === panelDataArray.length - 1;
  const pivotIndices = isLastPanel
    ? [panelIndex - 1, panelIndex]
    : [panelIndex, panelIndex + 1];

  const panelSize = layout[panelIndex];

  return {
    ...panelData.constraints,
    panelSize,
    pivotIndices,
  };
}
