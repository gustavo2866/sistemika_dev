"use client";

import { useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useResourceContext,
} from "ra-core";
import { CheckCircle2, XCircle } from "lucide-react";

import { useRowActionDialog } from "@/components/forms/form_order";
import { Confirm } from "@/components/confirm";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import type { PoOrderFormValues } from "./model";
import {
  buildPoOrderApprovalConfirmContent,
  canResolvePoOrder,
  getPoOrderApprovalLabel,
  runPoOrderApprovalAction,
  type PoOrderApprovalAction,
  type PoOrderApprovalRecord,
} from "./status-actions";

export const FormConfirmar = ({
  action,
  disabled,
  visible = true,
}: {
  action: PoOrderApprovalAction;
  disabled?: boolean;
  visible?: boolean;
}) => {
  const record = useRecordContext<
    PoOrderFormValues &
      PoOrderApprovalRecord & {
        id?: number;
      }
  >();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const resource = useResourceContext() ?? "po-orders";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dialog = useRowActionDialog();

  const label = getPoOrderApprovalLabel(action);
  const confirmContent = buildPoOrderApprovalConfirmContent(record, action);

  if (!record?.id || !visible || !canResolvePoOrder(record)) return null;

  const runConfirm = async () => {
    if (!record?.id) return;
    setLoading(true);
    try {
      await runPoOrderApprovalAction({
        action,
        dataProvider,
        record,
        resource,
      });
      notify(`Orden ${action === "approve" ? "aprobada" : "rechazada"}`, {
        type: "info",
      });
      refresh();
    } catch (error) {
      console.error(error);
      notify(
        error instanceof Error ? error.message : "No se pudo actualizar la orden",
        { type: "warning" },
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    await runConfirm();
    setOpen(false);
  };

  return (
    <>
      <DropdownMenuItem
        onSelect={(event) => {
          event.stopPropagation();
          if (disabled || loading) return;
          if (dialog) {
            dialog.openDialog({
              title: `${label} orden`,
              content: confirmContent,
              confirmLabel: label,
              confirmColor: action === "reject" ? "warning" : "primary",
              onConfirm: runConfirm,
            });
            return;
          }
          setOpen(true);
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
        disabled={disabled || loading}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      >
        {action === "approve" ? (
          <CheckCircle2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
        ) : (
          <XCircle className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
        )}
        {label}
      </DropdownMenuItem>
      {!dialog ? (
        <Confirm
          isOpen={open}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
          title={`${label} orden`}
          content={confirmContent}
          confirm={label}
          confirmColor={action === "reject" ? "warning" : "primary"}
          loading={loading}
        />
      ) : null}
    </>
  );
};
