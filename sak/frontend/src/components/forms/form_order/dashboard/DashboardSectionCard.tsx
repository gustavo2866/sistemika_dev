"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DashboardSectionCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: ReactNode;
};

export const DashboardSectionCard = ({
  title,
  description,
  actions,
  className,
  headerClassName,
  contentClassName,
  children,
}: DashboardSectionCardProps) => (
  <Card className={className}>
    {title || description || actions ? (
      <CardHeader className={cn("flex flex-col gap-3 md:flex-row md:items-center md:justify-between", headerClassName)}>
        <div className="space-y-1">
          {title ? <CardTitle>{title}</CardTitle> : null}
          {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </CardHeader>
    ) : null}
    <CardContent className={contentClassName}>{children}</CardContent>
  </Card>
);
