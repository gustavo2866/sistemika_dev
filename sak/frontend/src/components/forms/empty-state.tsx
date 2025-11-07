import { Card, CardContent } from "@/components/ui/card";
import { PackageOpen } from "lucide-react";
import { type ComponentType } from "react";

interface EmptyStateProps {
  message: string;
  Icon?: ComponentType<{ className?: string }>;
}

export const EmptyState = ({ 
  message, 
  Icon = PackageOpen 
}: EmptyStateProps) => {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <Icon className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
};
