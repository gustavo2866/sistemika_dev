"use client";

import { useMemo, useState } from "react";
import type { ComponentType, SyntheticEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Confirm } from "@/components/confirm";

export type TodoRowAction = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onSelect: () => void | Promise<void>;
  disabled?: boolean;
  separatorBefore?: boolean;
  confirm?: {
    title: string;
    content: string;
    confirmLabel?: string;
    confirmColor?: "primary" | "warning";
  };
};

export type TodoRowActionsProps = {
  actions: TodoRowAction[];
  triggerIcon?: ComponentType<{ className?: string }>;
  triggerLabel?: string;
  triggerClassName?: string;
  menuClassName?: string;
  loading?: boolean;
};

const stopEvent = (event: Event | SyntheticEvent) => {
  event.preventDefault();
  if ("stopPropagation" in event) {
    event.stopPropagation();
  }
};

export const TodoRowActions = ({
  actions,
  triggerIcon: TriggerIcon = MoreHorizontal,
  triggerLabel = "Opciones",
  triggerClassName = "h-8 w-8",
  menuClassName = "w-40 text-xs sm:w-44 sm:text-sm",
  loading,
}: TodoRowActionsProps) => {
  const [open, setOpen] = useState(false);
  const [confirmActionId, setConfirmActionId] = useState<string | null>(null);

  const confirmAction = useMemo(
    () => actions.find((action) => action.id === confirmActionId) ?? null,
    [actions, confirmActionId]
  );

  const handleSelect = async (action: TodoRowAction, event: Event | SyntheticEvent) => {
    stopEvent(event);
    if (action.disabled || loading) return;
    if (action.confirm) {
      setConfirmActionId(action.id);
      return;
    }
    await action.onSelect();
    setOpen(false);
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    await confirmAction.onSelect();
    setConfirmActionId(null);
    setOpen(false);
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={triggerClassName}
            onClick={stopEvent}
            disabled={loading}
          >
            <TriggerIcon className="h-4 w-4" />
            <span className="sr-only">{triggerLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={menuClassName}
          onClick={stopEvent}
          onPointerDown={stopEvent}
        >
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <div key={action.id}>
                {action.separatorBefore ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  onSelect={(event) => handleSelect(action, event)}
                  className="flex items-center gap-2"
                  disabled={action.disabled || loading}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  <span>{action.label}</span>
                </DropdownMenuItem>
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmAction?.confirm ? (
        <Confirm
          isOpen={Boolean(confirmActionId)}
          title={confirmAction.confirm.title}
          content={confirmAction.confirm.content}
          confirm={confirmAction.confirm.confirmLabel ?? "Confirmar"}
          confirmColor={confirmAction.confirm.confirmColor ?? "warning"}
          onClose={() => setConfirmActionId(null)}
          onConfirm={handleConfirm}
        />
      ) : null}
    </>
  );
};
