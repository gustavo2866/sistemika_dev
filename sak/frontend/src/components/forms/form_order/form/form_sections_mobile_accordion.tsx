import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export type FormSectionsMobileAccordionItem<T extends string> = {
  id: T;
  label: string;
};

export const FormSectionsMobileAccordion = <
  T extends string,
  TSection extends FormSectionsMobileAccordionItem<T>,
>({
  sections,
  renderSection,
  defaultOpenSectionIds,
}: {
  sections: TSection[];
  renderSection: (section: TSection) => ReactNode;
  defaultOpenSectionIds?: T[];
}) => {
  if (!sections.length) return null;

  const sectionIds = useMemo(() => sections.map((section) => section.id), [sections]);
  const fallbackOpenSectionIds = useMemo(() => {
    const requested = (defaultOpenSectionIds ?? []).filter((sectionId) =>
      sectionIds.includes(sectionId),
    );
    if (requested.length) return requested;
    return [sectionIds[0]] as T[];
  }, [defaultOpenSectionIds, sectionIds]);
  const [openSectionIds, setOpenSectionIds] = useState<T[]>(fallbackOpenSectionIds);
  const sectionIdsKey = sectionIds.join("|");
  const fallbackOpenSectionIdsKey = fallbackOpenSectionIds.join("|");

  useEffect(() => {
    setOpenSectionIds((currentOpenSectionIds) => {
      const nextOpenSectionIds = currentOpenSectionIds.filter((sectionId) =>
        sectionIds.includes(sectionId),
      );

      if (nextOpenSectionIds.length > 0) {
        if (
          nextOpenSectionIds.length === currentOpenSectionIds.length &&
          nextOpenSectionIds.every((sectionId, index) => sectionId === currentOpenSectionIds[index])
        ) {
          return currentOpenSectionIds;
        }
        return nextOpenSectionIds;
      }

      return fallbackOpenSectionIds;
    });
  }, [fallbackOpenSectionIds, fallbackOpenSectionIdsKey, sectionIds, sectionIdsKey]);

  return (
    <Accordion
      type="multiple"
      className="space-y-2"
      value={openSectionIds}
      onValueChange={(value) => setOpenSectionIds(value as T[])}
    >
      {sections.map((section) => (
        <AccordionItem
          key={section.id}
          value={section.id}
          className="overflow-hidden rounded-xl border border-border/70 bg-card px-3 shadow-xs"
        >
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            {section.label}
          </AccordionTrigger>
          <AccordionContent className="pb-3">{renderSection(section)}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};