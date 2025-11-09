import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormDetailCardMetaItem {
  label?: ReactNode;
  value: ReactNode;
}

export interface FormDetailCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: FormDetailCardMetaItem[];
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export const FormDetailCard = ({
  title,
  subtitle,
  meta,
  actions,
  children,
  className,
}: FormDetailCardProps) => {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-5 text-foreground">{title}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {meta && meta.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {meta.map((item, index) => (
            <div key={index} className="flex items-center gap-1">
              {item.label && <span className="font-medium">{item.label}:</span>}
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
};
