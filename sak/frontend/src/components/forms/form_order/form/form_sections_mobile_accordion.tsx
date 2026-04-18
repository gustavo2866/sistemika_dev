import type { ReactNode } from "react";

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

  return (
    <Accordion
      type="multiple"
      className="space-y-2"
      defaultValue={defaultOpenSectionIds ?? [sections[0].id]}
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