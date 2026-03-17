import type { SetupItem } from "./types";
import { SetupSidebarItem } from "./SetupSidebarItem";

// Renderiza el listado de opciones disponibles dentro del workspace de setup.
export const SetupSidebar = ({
  items,
  currentKey,
  getItemHref,
  onItemClick,
  title,
  description,
  showItemDescriptions = true,
}: {
  items: SetupItem[];
  currentKey?: string | null;
  getItemHref: (item: SetupItem) => string;
  onItemClick?: () => void;
  title?: string;
  description?: string;
  showItemDescriptions?: boolean;
}) => (
  <div className="flex flex-col gap-3">
    {title ? (
      <div className="rounded-xl border border-border/80 bg-background/80 px-3 py-3 shadow-xs">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Modulo
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    ) : null}
    <nav className="flex flex-col gap-1.5">
      {items.map((item) => (
        <SetupSidebarItem
          key={item.key}
          to={getItemHref(item)}
          label={item.label}
          description={item.description}
          isActive={item.key === currentKey}
          onClick={onItemClick}
          showDescription={showItemDescriptions}
        />
      ))}
    </nav>
  </div>
);
