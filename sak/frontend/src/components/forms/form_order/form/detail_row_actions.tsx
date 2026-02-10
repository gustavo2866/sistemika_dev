"use client";

import { cn } from "@/lib/utils";
import { DetailDeleteButton } from "./detail_delete_button";
import { DetailInfoButton } from "./detail_info_button";
import { DetailToggleButton } from "./detail_toggle_button";

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
  isActive,
  showOptional,
  onToggleOptional,
  onCollapse,
  onDelete,
}: {
  isActive: boolean;
  showOptional: boolean;
  onToggleOptional: () => void;
  onCollapse: () => void;
  onDelete: () => void;
}) => {
  if (!isActive) return null;

  const infoLabel = showOptional ? "Ocultar datos" : "Mostrar datos";

  return (
    <>
      <div className="flex items-end justify-end gap-0.5 -mr-0.5 sm:hidden">
        <DetailToggleButton
          show={showOptional}
          onToggle={onCollapse}
          className="text-muted-foreground"
          label="Cerrar edicion"
        />
        <DetailDeleteButton onClick={onDelete} />
        <DetailInfoButton onClick={onToggleOptional} label={infoLabel} />
      </div>
      <div className="hidden sm:flex items-center gap-0 shrink-0">
        <DetailToggleButton show={showOptional} onToggle={onCollapse} />
        <DetailDeleteButton onClick={onDelete} />
        <DetailInfoButton onClick={onToggleOptional} label={infoLabel} />
      </div>
    </>
  );
};
