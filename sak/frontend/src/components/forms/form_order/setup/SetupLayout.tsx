import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Renderiza la estructura general del workspace de setup con sidebar y contenido.
export const SetupLayout = ({
  sidebar,
  mobileNav,
  header,
  content,
  sidebarWidthClassName,
}: {
  sidebar?: ReactNode;
  mobileNav?: ReactNode;
  header: ReactNode;
  content: ReactNode;
  sidebarWidthClassName?: string;
}) => {
  const hasSidebar = Boolean(sidebar);

  return (
    <div className="space-y-4">
      {mobileNav}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div
          className={cn(
            "grid",
            hasSidebar
              ? (sidebarWidthClassName ?? "lg:grid-cols-[240px_minmax(0,1fr)]")
              : "grid-cols-1",
          )}
        >
          {hasSidebar ? (
            <aside className="hidden border-r border-border bg-muted/25 lg:block">
              <div className="p-3">{sidebar}</div>
            </aside>
          ) : null}
          <div className="min-w-0">
            {header}
            {content}
          </div>
        </div>
      </section>
    </div>
  );
};
