import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormDetailCardCompactMetaItem {
  label?: ReactNode;
  value: ReactNode;
}

export interface FormDetailCardCompactProps {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: FormDetailCardCompactMetaItem[];
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const renderMetaInline = (meta?: FormDetailCardCompactMetaItem[]) => {
  if (!meta || meta.length === 0) return null;
  return meta
    .map((item) => (item.label ? `${item.label}: ${item.value}` : `${item.value}`))
    .join(" - ");
};

export const FormDetailCardCompact = ({
  title,
  subtitle,
  meta,
  actions,
  children,
  className,
}: FormDetailCardCompactProps) => {
  const metaInline = renderMetaInline(meta);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] leading-4 text-foreground sm:text-sm">
            {title}
          </div>
          {subtitle ? (
            <div className="text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
              {subtitle}
            </div>
          ) : metaInline ? (
            <div className="truncate text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
              {metaInline}
            </div>
          ) : null}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {children ? (
        <div className="text-[9px] leading-4 text-muted-foreground sm:text-[10px]">
          {children}
        </div>
      ) : null}
    </div>
  );
};

