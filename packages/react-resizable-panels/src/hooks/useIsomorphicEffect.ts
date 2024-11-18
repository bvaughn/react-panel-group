import { isBrowser } from "#is-browser";
import { useLayoutEffect_do_not_use_directly } from "../vendor/react";

const useIsomorphicLayoutEffect = isBrowser
  ? useLayoutEffect_do_not_use_directly
  : () => undefined;

export default useIsomorphicLayoutEffect;
