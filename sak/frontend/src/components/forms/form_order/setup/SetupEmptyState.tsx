import type { ReactNode } from "react";

// Renderiza el estado vacio inicial del workspace de setup.
export const SetupEmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/15 px-6 text-center">
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? (
        <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {action}
  </div>
);
