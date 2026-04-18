import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FormSectionsDesktopLayoutItem<T extends string> = {
  id: T;
  label: string;
};

export const FormSectionsDesktopLayout = <T extends string>({
  sections,
  activeSection,
  onSectionChange,
  children,
}: {
  sections: Array<FormSectionsDesktopLayoutItem<T>>;
  activeSection: T;
  onSectionChange: (sectionId: T) => void;
  children: ReactNode;
}) => {
  const activeConfig = sections.find((section) => section.id === activeSection) ?? sections[0];

  return (
    <div className="hidden rounded-[28px] border border-border/60 bg-card/90 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] lg:grid lg:grid-cols-[98px_minmax(0,1fr)]">
      <aside className="border-r border-border/50 bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(241,245,249,0.96)_100%)] p-2">
        <div className="flex flex-col gap-1">
          {sections.map((section) => {
            const isActive = section.id === activeSection;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "group mr-[-10px] flex min-h-[34px] items-center justify-center rounded-l-lg rounded-r-none border border-r-0 px-2 py-1 text-center transition-all",
                  isActive
                    ? "-translate-x-2 border-border/80 bg-background text-foreground shadow-[10px_12px_30px_-24px_rgba(15,23,42,0.45)]"
                    : "border-transparent bg-muted/50 text-slate-500 hover:bg-muted/80 hover:text-slate-700",
                )}
                aria-pressed={isActive}
              >
                <span className="whitespace-normal break-words text-[10px] font-semibold leading-[1.05]">
                  {section.label}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="min-w-0 overflow-x-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(249,250,251,0.96)_100%)]">
        {activeConfig ? <div className="sr-only">{activeConfig.label}</div> : null}
        {children}
      </div>
    </div>
  );
};