import { Link } from "react-router";

import { cn } from "@/lib/utils";

// Renderiza una opcion navegable del menu lateral de setup.
export const SetupSidebarItem = ({
  to,
  label,
  description,
  isActive,
  onClick,
  showDescription = true,
}: {
  to: string;
  label: string;
  description?: string;
  isActive?: boolean;
  onClick?: () => void;
  showDescription?: boolean;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className={cn(
      "flex flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors",
      isActive
        ? "bg-background text-foreground shadow-xs ring-1 ring-border"
        : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
    )}
  >
    <span className="text-sm font-medium">{label}</span>
    {showDescription && description ? (
      <span className="text-xs leading-relaxed text-muted-foreground">
        {description}
      </span>
    ) : null}
  </Link>
);
