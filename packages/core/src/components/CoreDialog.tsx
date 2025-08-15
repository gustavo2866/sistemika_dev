"use client";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { ReactNode } from "react";

export interface CoreDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  onAccept: () => void;
  onCancel?: () => void;
  acceptLabel?: string;
  cancelLabel?: string;
}

export function CoreDialog({
  trigger,
  title,
  description,
  onAccept,
  onCancel,
  acceptLabel = "Aceptar",
  cancelLabel = "Cancelar"
}: CoreDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button onClick={onAccept}>{acceptLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
