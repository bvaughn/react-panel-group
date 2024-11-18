// This module exists to work around Webpack issue https://github.com/webpack/webpack/issues/14814
// and limitations with ParcelJS parsing of the useId workaround (used below).
// For the time being, all react-resizable-panels must import "react" with the "* as React" syntax.
// To avoid mistakes, we use the ESLint "no-restricted-imports" to prevent "react" imports except in this file.
// See https://github.com/bvaughn/react-resizable-panels/issues/118

// eslint-disable-next-line no-restricted-imports
import * as React from "react";

// eslint-disable-next-line no-restricted-imports
import type {
  CSSProperties,
  ElementType,
  ForwardedRef,
  HTMLAttributes,
  MouseEvent,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  RefObject,
  TouchEvent,
} from "react";

const {
  createElement,
  createContext,
  createRef,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} = React;

// `Math.random()` and `.slice(0, 5)` prevents bundlers from trying to `import { useId } from 'react'`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useId = (React as any)[
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  `useId${Math.random()}`.slice(0, 5)
] as () => string;

const useLayoutEffect_do_not_use_directly = useLayoutEffect;

export {
  createElement,
  createContext,
  createRef,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect_do_not_use_directly,
  useMemo,
  useRef,
  useState,
};

export type {
  CSSProperties,
  ElementType,
  ForwardedRef,
  HTMLAttributes,
  MouseEvent,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  RefObject,
  TouchEvent,
};
