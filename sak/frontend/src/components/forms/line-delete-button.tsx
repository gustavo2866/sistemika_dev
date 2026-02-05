import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const LineDeleteButton = ({
  onClick,
  label = "Eliminar",
  className,
  stopPropagation = true,
}: {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  label?: string;
  className?: string;
  stopPropagation?: boolean;
}) => {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-5 gap-[2px] px-1.5 text-[8px] leading-none text-muted-foreground hover:text-destructive",
        className
      )}
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
        onClick(event);
      }}
      aria-label={label}
    >
      <Trash2 className="size-[9px] stroke-[1.5] text-destructive/70" />
      {label}
    </Button>
  );
};
