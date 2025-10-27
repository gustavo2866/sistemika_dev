import { useCallback } from "react";
import type { RefObject, HTMLAttributes, KeyboardEvent } from "react";

import { useIsMobile } from "@/hooks/use-mobile";

const DATA_ATTRIBUTE = "data-enter-nav";

export type EnterNavigationMode = "next" | "submit";

export type EnterNavigationAttributes = Pick<
  HTMLAttributes<HTMLElement>,
  "onKeyDown" | "enterKeyHint"
> & {
  [DATA_ATTRIBUTE]: EnterNavigationMode;
};

export type EnterNavigationPropGetter = (
  mode?: EnterNavigationMode,
) => EnterNavigationAttributes;

type UseEnterNavigationOptions = {
  containerRef: RefObject<HTMLElement | null>;
  /**
   * Force-enable/disable the behaviour. Defaults to true only on mobile screens.
   */
  enabled?: boolean;
  /**
   * Callback used when the navigation reaches the end (i.e. last field).
   * When not provided, the hook will attempt to submit the closest form element.
   */
  submit?: () => void;
};

export const useEnterNavigation = ({
  containerRef,
  enabled,
  submit,
}: UseEnterNavigationOptions): {
  getEnterNavigationProps: EnterNavigationPropGetter;
} => {
  const isMobile = useIsMobile();
  const isEnabled = enabled ?? isMobile;

  const triggerSubmit = useCallback(() => {
    if (submit) {
      submit();
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const form =
      container instanceof HTMLFormElement
        ? container
        : container.querySelector<HTMLFormElement>("form");
    if (!form) {
      return;
    }
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    }
  }, [containerRef, submit]);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    const container = containerRef.current;
    if (!container) return [];

    const candidates = Array.from(
      container.querySelectorAll<HTMLElement>(`[${DATA_ATTRIBUTE}]`),
    );
    return candidates.filter(isFocusable);
  }, [containerRef]);

  const focusNext = useCallback(
    (current: HTMLElement) => {
      const focusables = getFocusableElements();
      if (focusables.length === 0) {
        triggerSubmit();
        return;
      }

      const currentIndex = focusables.findIndex((el) => el === current);

      for (let index = currentIndex + 1; index < focusables.length; index += 1) {
        const next = focusables[index];
        if (isFocusable(next)) {
          next.focus();
          if (
            next instanceof HTMLInputElement ||
            next instanceof HTMLTextAreaElement
          ) {
            next.select?.();
          }
          return;
        }
      }

      triggerSubmit();
    },
    [getFocusableElements, triggerSubmit],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, mode: EnterNavigationMode) => {
      if (!isEnabled) return;
      if (event.defaultPrevented) return;
      if (event.key !== "Enter" || event.nativeEvent.isComposing) return;

      const targetElement = (event.target as HTMLElement | null)?.closest(
        `[${DATA_ATTRIBUTE}]`,
      ) as HTMLElement | null;

      if (!targetElement) return;

      if (mode === "submit") {
        event.preventDefault();
        triggerSubmit();
        return;
      }

      if (event.shiftKey) {
        // allow Shift+Enter (e.g. to add new lines) – treat as regular behaviour
        return;
      }

      event.preventDefault();
      focusNext(targetElement);
    },
    [focusNext, isEnabled, triggerSubmit],
  );

  const getEnterNavigationProps = useCallback<
    EnterNavigationPropGetter
  >(
    (mode: EnterNavigationMode = "next") => ({
      [DATA_ATTRIBUTE]: mode,
      enterKeyHint: mode === "submit" ? "done" : "next",
      onKeyDown: (event) => handleKeyDown(event, mode),
    }),
    [handleKeyDown],
  );

  return { getEnterNavigationProps };
};

const isFocusable = (element: HTMLElement): boolean => {
  if (element.hasAttribute("disabled")) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  if (element.tabIndex === -1) return false;
  if (
    element instanceof HTMLInputElement &&
    element.type &&
    element.type.toLowerCase() === "hidden"
  )
    return false;
  if (typeof window !== "undefined") {
    const style = window.getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return false;
  }
  if (element.closest("[aria-hidden='true']")) return false;
  return true;
};
