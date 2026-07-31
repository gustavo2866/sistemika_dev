"use client";

import { ResourceContextProvider } from "ra-core";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ErpPresupuestoCreate } from "../create";
import { ErpPresupuestoEdit } from "../edit";
import type { ErpPresupuestoFormValues } from "../model";
import { formatMonthLabel } from "./utils";

export type BudgetFormDialogRequest =
  | {
      mode: "create";
      month: string;
      label: string;
      initialValues: Partial<ErpPresupuestoFormValues>;
    }
  | {
      mode: "edit";
      id: number;
      month: string;
      label: string;
    };

type BudgetFormDialogProps = {
  request: BudgetFormDialogRequest | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
};

export const BudgetFormDialog = ({
  request,
  onOpenChange,
  onSaved,
}: BudgetFormDialogProps) => {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(94vw,760px)] max-w-[760px] gap-2 p-3 sm:max-w-[760px]"
        overlayClassName="bg-transparent backdrop-blur-none"
      >
        <DialogHeader className="gap-1">
          <DialogTitle className="text-sm">
            {request?.mode === "edit" ? "Editar presupuesto" : "Crear presupuesto"}
          </DialogTitle>
          <div className="truncate pr-8 text-[10px] text-muted-foreground">
            {request ? `${formatMonthLabel(request.month)} - ${request.label}` : ""}
          </div>
        </DialogHeader>

        {request ? (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <ResourceContextProvider value="erp/presupuestos">
              {request.mode === "edit" ? (
                <ErpPresupuestoEdit
                  embedded
                  id={request.id}
                  redirect={false}
                  onCancel={close}
                  onSaved={() => {
                    close();
                    void onSaved();
                  }}
                />
              ) : (
                <ErpPresupuestoCreate
                  embedded
                  redirect={false}
                  initialValues={request.initialValues}
                  onCancel={close}
                  onSaved={() => {
                    close();
                    void onSaved();
                  }}
                />
              )}
            </ResourceContextProvider>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
