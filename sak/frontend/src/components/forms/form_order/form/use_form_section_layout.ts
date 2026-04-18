import { useEffect, useState } from "react";

const getMatches = (minWidth: number) => {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= minWidth;
};

export const useMinWidth = (minWidth: number) => {
  const [matches, setMatches] = useState(() => getMatches(minWidth));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia(`(min-width: ${minWidth}px)`);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [minWidth]);

  return matches;
};

type UsePersistedActiveSectionOptions<T extends string> = {
  storageKey: string;
  sections: readonly T[];
  defaultSection: T;
};

const readStoredSection = <T extends string>({
  storageKey,
  sections,
  defaultSection,
}: UsePersistedActiveSectionOptions<T>) => {
  if (typeof window === "undefined") return defaultSection;
  const storedValue = window.sessionStorage.getItem(storageKey);
  return storedValue && sections.includes(storedValue as T) ? (storedValue as T) : defaultSection;
};

export const usePersistedActiveSection = <T extends string>({
  storageKey,
  sections,
  defaultSection,
}: UsePersistedActiveSectionOptions<T>) => {
  const [activeSection, setActiveSection] = useState<T>(() =>
    readStoredSection({ storageKey, sections, defaultSection }),
  );

  useEffect(() => {
    setActiveSection(readStoredSection({ storageKey, sections, defaultSection }));
  }, [defaultSection, sections, storageKey]);

  useEffect(() => {
    if (sections.includes(activeSection)) return;
    setActiveSection(sections[0] ?? defaultSection);
  }, [activeSection, defaultSection, sections]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(storageKey, activeSection);
  }, [activeSection, storageKey]);

  return [activeSection, setActiveSection] as const;
};