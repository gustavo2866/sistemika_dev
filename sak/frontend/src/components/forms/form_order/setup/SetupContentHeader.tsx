import type { ReactNode } from "react";

// Renderiza el encabezado contextual de la opcion seleccionada en setup.
export const SetupContentHeader = ({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) => (
  <header className="border-b border-border bg-background/70">
    <div className="px-5 py-5 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        CRM Setup
      </p>
      <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
    {actions ? <div className="px-5 sm:px-6">{actions}</div> : null}
  </header>
);
