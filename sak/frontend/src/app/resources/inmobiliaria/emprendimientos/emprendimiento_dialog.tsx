"use client";

import { ResourceContextProvider } from "ra-core";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { EmprendimientoCreate } from "./create";

export const EmprendimientoDialog = ({
  contained = false,
  contentClassName,
  open,
  onOpenChange,
  onCreated,
  overlayClassName,
  portalContainer,
  title = "Crear emprendimiento",
}: {
  contained?: boolean;
  contentClassName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (record: Record<string, unknown>) => void;
  overlayClassName?: string;
  portalContainer?: HTMLElement | null;
  title?: string;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className={cn("flex max-h-[90vh] flex-col overflow-hidden p-0", "sm:max-w-4xl", contentClassName)}
      contained={contained}
      overlayClassName={overlayClassName}
      portalContainer={portalContainer}
    >
      <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-6">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto px-6 pb-6 pt-4 overscroll-contain">
        <ResourceContextProvider value="emprendimientos">
          <EmprendimientoCreate
            embedded
            onCreated={onCreated}
            onCancel={() => onOpenChange(false)}
          />
        </ResourceContextProvider>
      </div>
    </DialogContent>
  </Dialog>
);
