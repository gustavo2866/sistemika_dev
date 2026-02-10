"use client";

import type { MouseEvent } from "react";
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
    <div className={cn("hidden sm:flex items-center gap-0 shrink-0", className)}>
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
  if (!isActive) return null;

  const infoLabel = showOptional ? "Ocultar datos" : "Mostrar datos";
  const handleToggleOptional = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    toggleOptional();
  };

  return (
    <>
      <div className="flex items-end justify-end gap-0.5 -mr-0.5 sm:hidden">
        <DetailToggleButton
          show={showOptional}
          onToggle={collapse}
          className="text-muted-foreground"
          label="Cerrar edicion"
        />
        <DetailDeleteButton onClick={remove} />
        <DetailInfoButton onClick={handleToggleOptional} label={infoLabel} />
      </div>
      <div className="hidden sm:flex items-center gap-0 shrink-0">
        <DetailToggleButton show={showOptional} onToggle={collapse} />
        <DetailDeleteButton onClick={remove} />
        <DetailInfoButton onClick={handleToggleOptional} label={infoLabel} />
      </div>
    </>
  );
};
