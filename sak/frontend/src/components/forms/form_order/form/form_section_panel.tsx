import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const FormSectionPanel = ({
  title,
  description,
  actions,
  toolbar,
  children,
  minHeightClassName = "min-h-[24rem]",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  minHeightClassName?: string;
}) => (
  <section className={cn("flex flex-col", minHeightClassName)}>
    {title || description || actions || toolbar ? (
      <div className="border-b border-border/50 px-4 py-3 xl:px-5">
        {title || description || actions ? (
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              {title ? (
                <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
              ) : null}
              {description ? (
                <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </div>
        ) : null}
        {toolbar ? <div className={cn("flex min-w-0", (title || description || actions) && "mt-2")}>{toolbar}</div> : null}
      </div>
    ) : null}
    <div className="min-w-0 overflow-x-auto px-4 py-4 xl:px-6 xl:py-5">{children}</div>
  </section>
);
