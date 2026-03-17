import { Link } from "react-router";

import { cn } from "@/lib/utils";
import type { SetupView } from "./types";

// Renderiza el selector de vistas disponibles para la opcion elegida.
export const SetupViewSwitcher = ({
  currentView,
  listTo,
  createTo,
  canCreate = true,
}: {
  currentView: SetupView;
  listTo: string;
  createTo?: string;
  canCreate?: boolean;
}) => (
  <nav className="flex items-center gap-5 border-t border-border/70">
    <Link
      to={listTo}
      className={cn(
        "inline-flex border-b-2 px-1 py-3 text-sm font-medium transition-colors",
        currentView === "list"
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      Listado
    </Link>
    {canCreate && createTo ? (
      <Link
        to={createTo}
        className={cn(
          "inline-flex border-b-2 px-1 py-3 text-sm font-medium transition-colors",
          currentView === "create"
            ? "border-foreground text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        Crear
      </Link>
    ) : null}
  </nav>
);
