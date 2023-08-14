import { convertPixelsToPercentage } from "./convertPixelsToPercentage";
import { PanelConstraints } from "./types";

export function computePercentagePanelConstraints(
  panelConstraintsArray: PanelConstraints[],
  panelIndex: number,
  groupSizePixels: number
): {
  collapsedSizePercentage: number;
  defaultSizePercentage: number | undefined;
  maxSizePercentage: number;
  minSizePercentage: number;
} {
  // All panel constraints, excluding the current one
  let totalMinConstraints = 0;
  let totalMaxConstraints = 0;

  for (let index = 0; index < panelConstraintsArray.length; index++) {
    if (index !== panelIndex) {
      const { collapsible } = panelConstraintsArray[index]!;
      const { collapsedSizePercentage, maxSizePercentage, minSizePercentage } =
        convertPixelConstraintsToPercentages(
          panelConstraintsArray[index]!,
          groupSizePixels
        );

      totalMaxConstraints += maxSizePercentage;
      totalMinConstraints += collapsible
        ? collapsedSizePercentage
        : minSizePercentage;
    }
  }

  const {
    collapsedSizePercentage,
    defaultSizePercentage,
    maxSizePercentage,
    minSizePercentage,
  } = convertPixelConstraintsToPercentages(
    panelConstraintsArray[panelIndex]!,
    groupSizePixels
  );

  return {
    collapsedSizePercentage,
    defaultSizePercentage,
    maxSizePercentage:
      panelConstraintsArray.length > 1
        ? Math.min(maxSizePercentage, 100 - totalMinConstraints)
        : maxSizePercentage,
    minSizePercentage:
      panelConstraintsArray.length > 1
        ? Math.max(minSizePercentage, 100 - totalMaxConstraints)
        : minSizePercentage,
  };
}

export function convertPixelConstraintsToPercentages(
  panelConstraints: PanelConstraints,
  groupSizePixels: number
): {
  collapsedSizePercentage: number;
  defaultSizePercentage: number | undefined;
  maxSizePercentage: number;
  minSizePercentage: number;
} {
  let {
    collapsedSizePercentage = 0,
    collapsedSizePixels,
    defaultSizePercentage,
    defaultSizePixels,
    maxSizePercentage = 100,
    maxSizePixels,
    minSizePercentage = 0,
    minSizePixels,
  } = panelConstraints;

  if (collapsedSizePixels != null) {
    collapsedSizePercentage = convertPixelsToPercentage(
      collapsedSizePixels,
      groupSizePixels
    );
  }
  if (defaultSizePixels != null) {
    defaultSizePercentage = convertPixelsToPercentage(
      defaultSizePixels,
      groupSizePixels
    );
  }
  if (minSizePixels != null) {
    minSizePercentage = convertPixelsToPercentage(
      minSizePixels,
      groupSizePixels
    );
  }
  if (maxSizePixels != null) {
    maxSizePercentage = convertPixelsToPercentage(
      maxSizePixels,
      groupSizePixels
    );
  }

  return {
    collapsedSizePercentage,
    defaultSizePercentage,
    maxSizePercentage,
    minSizePercentage,
  };
}
