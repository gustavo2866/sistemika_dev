/**
 * MobileList - Mobile view with cards
 * 
 * Renders records as cards with actions
 */

import {
  useListContext,
  RecordContextProvider,
  useRecordContext,
  type Identifier,
  type RaRecord,
} from "ra-core";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { BulkActionsToolbar } from "@/components/bulk-actions-toolbar";
import { cn } from "@/lib/utils";
import { ListConfig } from "../types";
import { RowActions } from "./RowActions";
import { useMobileCardRenderer } from "../hooks";

interface MobileListProps {
  config: ListConfig;
}

export const MobileList = ({ config }: MobileListProps) => {
  const {
    data,
    isLoading,
    selectedIds = [],
    onToggleItem,
  } = useListContext<RaRecord>();

  const renderCardContent = useMobileCardRenderer(config);
  const hasRecords = (data ?? []).length > 0;
  const handleToggleItem = onToggleItem as ((id: Identifier) => void) | undefined;

  // Check if bulk actions are available
  const hasBulkActions = config.actions?.some(action => action.bulk) || false;

  if (isLoading && !hasRecords) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card className="flex gap-3 p-4" key={`skeleton-${index}`}>
            <Skeleton className="size-5 rounded-sm" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!hasRecords) {
    return (
      <Card className="m-4 flex flex-col items-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <span>No se encontraron registros.</span>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3 p-4">
        {data?.map((record, index) => (
          <RecordContextProvider
            key={record?.id ?? `record-${index}`}
            value={record}
          >
            <MobileCard
              config={config}
              isSelected={
                record?.id != null && selectedIds.includes(record.id)
              }
              onToggleItem={handleToggleItem}
              hasBulkActions={hasBulkActions}
              renderContent={renderCardContent}
            />
          </RecordContextProvider>
        ))}
      </div>
      
      {hasBulkActions && selectedIds.length > 0 && (
        <BulkActionsToolbar>
          {/* TODO: Implement bulk action buttons */}
          <div className="text-sm">
            {selectedIds.length} seleccionado(s)
          </div>
        </BulkActionsToolbar>
      )}
    </>
  );
};

interface MobileCardProps {
  config: ListConfig;
  isSelected: boolean;
  onToggleItem?: (id: Identifier) => void;
  hasBulkActions: boolean;
  renderContent: (record: RaRecord) => React.ReactNode;
}

const MobileCard = ({
  config,
  isSelected,
  onToggleItem,
  hasBulkActions,
  renderContent,
}: MobileCardProps) => {
  const record = useRecordContext<RaRecord>();

  if (!record) return null;

  const rowActions = config.actions?.filter(a => a.individual !== "none") || [];
  const hasActions = rowActions.length > 0;

  // Handle card click using rowClick config
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox or actions
    const target = e.target as HTMLElement;
    if (target.closest('[role="checkbox"], button, [role="menuitem"]')) {
      return;
    }

    if (config.rowClick && record.id) {
      const path = typeof config.rowClick === 'function' 
        ? config.rowClick(record.id)
        : config.rowClick;
      window.location.href = path;
    }
  };

  return (
    <Card
      className={cn(
        "transition-shadow",
        isSelected && "border-primary/70 shadow-sm shadow-primary/20",
        config.rowClick && "cursor-pointer hover:shadow-md",
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Checkbox for bulk selection */}
        {hasBulkActions && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => {
              if (record.id == null) return;
              onToggleItem?.(record.id);
            }}
            className="mt-1"
            aria-label="Seleccionar registro"
          />
        )}

        {/* Card content */}
        <div className="flex-1 min-w-0">
          {renderContent(record)}
        </div>

        {/* Actions */}
        {hasActions && (
          <div className="flex-shrink-0">
            <RowActions 
              actions={rowActions}
              mode="menu"  // Mobile always uses menu for space
            />
          </div>
        )}
      </div>
    </Card>
  );
};
