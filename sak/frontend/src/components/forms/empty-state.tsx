import { Card, CardContent } from "@/components/ui/card";
import { PackageOpen } from "lucide-react";
import { type ComponentType } from "react";

interface EmptyStateProps {
  message: string;
  Icon?: ComponentType<{ className?: string }>;
  className?: string;
  contentClassName?: string;
  iconClassName?: string;
  textClassName?: string;
}

export const EmptyState = ({ 
  message, 
  Icon = PackageOpen,
  className,
  contentClassName,
  iconClassName,
  textClassName,
}: EmptyStateProps) => {
  return (
    <Card className={className ?? "border-dashed"}>
      <CardContent className={contentClassName ?? "flex flex-col items-center justify-center py-10 text-center"}>
        <Icon className={iconClassName ?? "mb-4 h-12 w-12 text-muted-foreground/50"} />
        <p className={textClassName ?? "text-sm text-muted-foreground"}>{message}</p>
      </CardContent>
    </Card>
  );
};
