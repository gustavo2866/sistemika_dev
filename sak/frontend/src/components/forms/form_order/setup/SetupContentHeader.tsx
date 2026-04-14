import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Renderiza el encabezado contextual de la opcion seleccionada en setup.
export const SetupContentHeader = ({
  eyebrowLabel = "CRM Setup",
  title,
  description,
  actions,
  actionsPlacement = "below",
  contentClassName,
  actionsClassName,
  titleClassName,
  eyebrowClassName,
}: {
  eyebrowLabel?: string;
  title?: ReactNode | string | false;
  description?: string;
  actions?: ReactNode;
  actionsPlacement?: "below" | "inline";
  contentClassName?: string;
  actionsClassName?: string;
  titleClassName?: string;
  eyebrowClassName?: string;
}) => (
  <header className="border-b border-border bg-background/70">
    <div className={cn("px-5 py-5 sm:px-6", contentClassName)}>
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
          eyebrowClassName,
        )}
      >
        {eyebrowLabel}
      </p>
      <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        {title !== false || description ? (
          <div className="space-y-1">
            {title !== false ? (
              <h1
                className={cn(
                  "text-2xl font-semibold tracking-tight sm:text-[2rem]",
                  titleClassName,
                )}
              >
                {title}
              </h1>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        ) : null}
        {actions && actionsPlacement === "inline" ? (
          <div className={cn("min-w-0", actionsClassName)}>{actions}</div>
        ) : null}
      </div>
    </div>
    {actions && actionsPlacement === "below" ? (
      <div className={cn("px-5 sm:px-6", actionsClassName)}>{actions}</div>
    ) : null}
  </header>
);
