"use client";

const FOCUSABLE_SELECTOR =
  'input,textarea,select,button,[role="combobox"],[tabindex]:not([tabindex="-1"])';

const isVisible = (el: HTMLElement) =>
  !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

const isDisabled = (el: HTMLElement) =>
  el.hasAttribute("disabled") ||
  el.getAttribute("aria-disabled") === "true";

export const focusNextInScope = (fromEl: HTMLElement | null) => {
  if (!fromEl) return false;
  const scope =
    fromEl.closest('[data-focus-scope="detail-row"]') ?? fromEl.parentElement;
  if (!scope) return false;

  const candidates = Array.from(
    scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => !isDisabled(el) && isVisible(el));

  if (!candidates.length) return false;

  const currentIndex = candidates.findIndex((el) => el === fromEl);
  const nextIndex =
    currentIndex >= 0 ? currentIndex + 1 : Math.max(0, candidates.length - 1);
  const next = candidates[nextIndex] ?? candidates[0];
  next?.focus();
  return true;
};
