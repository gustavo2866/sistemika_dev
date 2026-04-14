import { Link } from "react-router";

import { cn } from "@/lib/utils";

import type { SetupItem } from "./types";

// Renderiza la navegacion secundaria del setup como una fila horizontal scrolleable.
export const SetupSectionNav = ({
  items,
  currentKey,
  getItemHref,
  className,
}: {
  items: SetupItem[];
  currentKey?: string | null;
  getItemHref: (item: SetupItem) => string;
  className?: string;
}) => (
  <nav
    aria-label="Secciones de setup"
    className={cn("overflow-x-auto", className)}
  >
    <div className="inline-flex min-w-0 items-center gap-1 rounded-xl border border-border/70 bg-muted/20 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
      {items.map((item) => {
        const isActive = item.key === currentKey;

        return (
          <Link
            key={item.key}
            to={getItemHref(item)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative inline-flex h-8 shrink-0 items-center rounded-lg px-3.5 text-[13px] font-medium transition-all duration-150",
              isActive
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
          >
            {isActive ? (
              <span className="absolute inset-y-1.5 left-1.5 w-[3px] rounded-full bg-foreground/80" />
            ) : null}
            <span className={cn("truncate", isActive && "pl-2.5")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  </nav>
);
