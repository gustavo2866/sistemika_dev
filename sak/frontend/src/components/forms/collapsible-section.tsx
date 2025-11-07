import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  headerContent?: ReactNode;
  onToggle?: (isOpen: boolean) => void;
}

export const CollapsibleSection = ({
  title,
  subtitle,
  defaultOpen = true,
  children,
  headerContent,
  onToggle,
}: CollapsibleSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const newState = !open;
    setOpen(newState);
    onToggle?.(newState);
  };

  return (
    <Card>
      <div className="border-b px-4 py-3">
        <div className="flex items-start gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-1 h-8 w-8"
            onClick={handleToggle}
            aria-label={open ? `Colapsar ${title}` : `Expandir ${title}`}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
            />
          </Button>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{title}</h3>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {headerContent && <div className="mt-3">{headerContent}</div>}
      </div>
      <CardContent className={`space-y-4 ${open ? "block" : "hidden"} p-4`}>
        {children}
      </CardContent>
    </Card>
  );
};
