"use client";

import type { MouseEvent } from "react";
import { useFormContext } from "react-hook-form";
import { useSimpleFormIterator, useSimpleFormIteratorItem } from "ra-core";
import { cn } from "@/lib/utils";
import { DetailDeleteButton } from "./detail_delete_button";
import { DetailInfoButton } from "./detail_info_button";
import { DetailToggleButton } from "./detail_toggle_button";
import { useDetailRowContext } from "./detail_row_context";

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
}: {} = {}) => {
  const { isActive, showOptional, toggleOptional, collapse, remove } =
    useDetailRowContext();
  const { trigger, getValues } = useFormContext();
  const { source } = useSimpleFormIterator();
  const { index } = useSimpleFormIteratorItem();
  if (!isActive) return null;

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
  const handleToggleOptional = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    toggleOptional();
  };
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

  return (
    <>
      <div className="flex items-end justify-end gap-0.5 -mr-0.5 sm:hidden">
        <DetailToggleButton
          show={showOptional}
          onToggle={handleCollapse}
          className="text-muted-foreground"
          label="Cerrar edicion"
        />
        <DetailDeleteButton onClick={remove} />
        <DetailInfoButton onClick={handleToggleOptional} label={infoLabel} />
      </div>
      <div className="hidden sm:flex items-center gap-0 shrink-0 sm:justify-self-start sm:justify-start">
        <DetailToggleButton show={showOptional} onToggle={handleCollapse} />
        <DetailDeleteButton onClick={remove} />
        <DetailInfoButton onClick={handleToggleOptional} label={infoLabel} />
      </div>
    </>
  );
};
