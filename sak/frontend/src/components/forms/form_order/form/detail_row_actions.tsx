"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { ChevronDown, ChevronRight, Pencil, Save } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useSimpleFormIterator, useSimpleFormIteratorItem } from "ra-core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DetailDeleteButton } from "./detail_delete_button";
import { DetailInfoButton } from "./detail_info_button";
import { DetailToggleButton } from "./detail_toggle_button";
import { useDetailRowContext } from "./detail_row_context";
import { useDetailSectionContext } from "./detail_section_context";

export const DetailRowMobileDelete = ({
  onDelete,
  className,
}: {
  onDelete: () => void;
  className?: string;
}) => {
  return (
    <DetailDeleteButton
      className={cn("sm:hidden h-5 w-5 -mr-1", className)}
      onClick={onDelete}
    />
  );
};

export const DetailRowMobileToggle = ({
  show,
  onToggle,
  className,
}: {
  show: boolean;
  onToggle: () => void;
  className?: string;
}) => {
  return (
    <div className={cn("flex items-end justify-end sm:hidden -mr-1", className)}>
      <DetailToggleButton show={show} onToggle={onToggle} />
    </div>
  );
};

export const DetailRowDesktopActions = ({
  show,
  onToggle,
  onDelete,
  info,
  className,
}: {
  show: boolean;
  onToggle: () => void;
  onDelete: () => void;
  info?: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "hidden sm:flex items-center gap-0 shrink-0 sm:justify-self-start sm:justify-start",
        className,
      )}
    >
      <DetailToggleButton show={show} onToggle={onToggle} />
      <DetailDeleteButton onClick={onDelete} />
      {info}
    </div>
  );
};

export const DetailRowActions = ({
  mode = "both",
  readOnly = false,
  forceVisible = false,
  showInfo = true,
  showInfoWhenInactive = false,
  showDeleteWhenInactive = false,
  saveOnlyWhenActive = false,
  showExpandActionOnMobile = false,
  showExpandAction = false,
  variant = "compact",
  canDelete = true,
}: {
  mode?: "mobile" | "desktop" | "both";
  readOnly?: boolean;
  forceVisible?: boolean;
  showInfo?: boolean;
  showInfoWhenInactive?: boolean;
  showDeleteWhenInactive?: boolean;
  saveOnlyWhenActive?: boolean;
  showExpandActionOnMobile?: boolean;
  showExpandAction?: boolean;
  variant?: "compact" | "table";
  canDelete?: boolean;
} = {}) => {
  const { isActive, showOptional, toggleOptional, collapse, remove } =
    useDetailRowContext();
  const detailContext = useDetailSectionContext();
  const { trigger, getValues } = useFormContext();
  const { source } = useSimpleFormIterator();
  const { index } = useSimpleFormIteratorItem();
  const isTableVariant = variant === "table";
  const collectFieldNames = (value: unknown, path: string): string[] => {
    if (value == null) return [path];
    if (Array.isArray(value)) {
      if (value.length === 0) return [path];
      return value.flatMap((item, idx) =>
        collectFieldNames(item, `${path}.${idx}`),
      );
    }
    if (typeof value === "object") {
      const keys = Object.keys(value as Record<string, unknown>);
      if (keys.length === 0) return [path];
      return keys.flatMap((key) =>
        collectFieldNames(
          (value as Record<string, unknown>)[key],
          `${path}.${key}`,
        ),
      );
    }
    return [path];
  };

  const infoLabel = showOptional ? "Ocultar datos" : "Mostrar datos";
  const ExpandIcon = showOptional ? ChevronDown : ChevronRight;
  const handleToggleOptional = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    toggleOptional();
  };
  const handleActivate = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    detailContext?.onRowClick?.(index)(event as unknown as MouseEvent);
  };
  const handleRemove = () => {
    if (!canDelete) return;
    remove();
  };

  if (!isActive && !forceVisible) {
    if (!isTableVariant && (!showInfo || !showInfoWhenInactive) && !showDeleteWhenInactive) return null;
    const showInactiveInfo = showInfo && showInfoWhenInactive;
    const showInactiveDelete = showDeleteWhenInactive && !readOnly;
    if (!showInactiveInfo && !showInactiveDelete && (!isTableVariant || readOnly)) return null;
    const inactiveActions = (
      <>
        {showInactiveInfo ? (
          <DetailInfoButton
            onClick={handleToggleOptional}
            label={infoLabel}
            active={showOptional}
            className={isTableVariant ? "h-7 w-7 rounded-md text-blue-600" : undefined}
            iconClassName={isTableVariant ? "size-3.5" : undefined}
          />
        ) : null}
        {showExpandAction || showExpandActionOnMobile ? (
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={handleToggleOptional}
            aria-label={infoLabel}
            title={infoLabel}
            tabIndex={-1}
          >
            <ExpandIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {isTableVariant && !readOnly ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              onClick={handleActivate}
              aria-label="Editar linea"
              title="Editar linea"
              tabIndex={-1}
            >
              <Pencil className="size-3.5" />
            </Button>
            <DetailDeleteButton
              onClick={handleRemove}
              className="h-7 w-7 rounded-md"
              iconClassName="size-3.5 text-red-500"
              disabled={!canDelete}
            />
          </>
        ) : null}
        {!isTableVariant && showInactiveDelete ? (
          <DetailDeleteButton
            onClick={handleRemove}
            className="sm:ml-auto sm:mr-6"
            disabled={!canDelete}
          />
        ) : null}
      </>
    );
    return (
      <>
        {mode !== "desktop" ? (
          <div className="flex items-end justify-end gap-0.5 -mr-0.5 sm:hidden">
            {inactiveActions}
          </div>
        ) : null}
        {mode !== "mobile" ? (
          <div
            className={cn(
              "hidden sm:flex items-center gap-3 shrink-0",
              isTableVariant
                ? "justify-end sm:justify-self-end"
                : "w-full justify-start sm:justify-self-stretch",
            )}
          >
            {inactiveActions}
          </div>
        ) : null}
      </>
    );
  }

  if (readOnly) {
    if (!showInfo) return null;
    return (
      <>
        {mode !== "desktop" ? (
          <div className="flex items-end justify-end gap-0.5 -mr-0.5 sm:hidden">
            <DetailInfoButton
              onClick={handleToggleOptional}
              label={infoLabel}
              active={showOptional}
            />
          </div>
        ) : null}
        {mode !== "mobile" ? (
          <div className="hidden sm:flex items-center gap-0 shrink-0 sm:justify-self-start sm:justify-start">
            <DetailInfoButton
              onClick={handleToggleOptional}
              label={infoLabel}
              active={showOptional}
            />
          </div>
        ) : null}
      </>
    );
  }
  const handleCollapse = async () => {
    if (source) {
      const rowPath = `${source}.${index}`;
      const rowValue = getValues(rowPath);
      const fieldNames = collectFieldNames(rowValue, rowPath);
      const target = fieldNames.length ? fieldNames : rowPath;
      const isValid = await trigger(target, {
        shouldFocus: true,
      });
      if (!isValid) return;
    }
    collapse();
  };
  const focusFirstFieldInRow = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    const row = event.currentTarget.closest('[data-focus-scope="detail-row"]');
    const firstField = row?.querySelector('[data-focus-field="true"]');
    const focusTarget =
      (firstField?.querySelector('[role="combobox"]') as HTMLElement | null) ??
      (firstField?.querySelector("input, textarea, button") as HTMLElement | null) ??
      (firstField as HTMLElement | null);
    if (!focusTarget) return;

    event.preventDefault();
    event.stopPropagation();
    focusTarget.focus();
  };

  if ((isTableVariant || saveOnlyWhenActive) && isActive) {
    const expandButton =
      showExpandAction || showExpandActionOnMobile ? (
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          onClick={handleToggleOptional}
          aria-label={infoLabel}
          title={infoLabel}
          tabIndex={-1}
        >
          <ExpandIcon className="h-3.5 w-3.5" />
        </button>
      ) : null;
    const saveButton = (
      <Button
        type="button"
        variant="secondary"
        className={cn(
          "flex-col gap-0 font-medium leading-none shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500",
          isTableVariant
            ? "h-7 min-w-7 px-1 text-[6px] has-[>svg]:px-1"
            : "h-4 min-w-5 rounded px-0.5 py-0 text-[5px] has-[>svg]:px-0.5",
          !isTableVariant && "sm:ml-auto sm:mr-6",
        )}
        onClick={(event) => {
          event.stopPropagation();
          void handleCollapse();
        }}
        onKeyDown={focusFirstFieldInRow}
        aria-label="Guardar linea"
        title="Guardar linea"
      >
        <Save className={cn(isTableVariant ? "size-3" : "size-2.5")} />
        <span>Guardar</span>
      </Button>
    );

    return (
      <>
        {mode !== "desktop" ? (
          <div className="flex items-end justify-center gap-0.5 -mr-0.5 sm:hidden">
            {showExpandActionOnMobile ? expandButton : null}
            {saveButton}
          </div>
        ) : null}
        {mode !== "mobile" ? (
          <div
            className={cn(
              "hidden sm:flex items-center gap-3 shrink-0",
              isTableVariant
                ? "justify-end sm:justify-self-end"
                : "w-full justify-start sm:justify-self-stretch",
            )}
          >
            {showExpandAction ? expandButton : null}
            {saveButton}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      {mode !== "desktop" ? (
        <div className="flex items-end justify-end gap-0.5 -mr-0.5 sm:hidden">
          <DetailToggleButton
            show={showOptional}
            onToggle={handleCollapse}
            className="text-muted-foreground"
            label="Cerrar edicion"
          />
          <DetailDeleteButton onClick={handleRemove} disabled={!canDelete} />
          {showInfo ? (
            <DetailInfoButton
              onClick={handleToggleOptional}
              label={infoLabel}
              active={showOptional}
            />
          ) : null}
        </div>
      ) : null}
      {mode !== "mobile" ? (
        <div className="hidden sm:flex items-center gap-0 shrink-0 sm:justify-self-start sm:justify-start">
          <DetailToggleButton show={showOptional} onToggle={handleCollapse} />
          <DetailDeleteButton onClick={handleRemove} disabled={!canDelete} />
          {showInfo ? (
            <DetailInfoButton
              onClick={handleToggleOptional}
              label={infoLabel}
              active={showOptional}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
};
