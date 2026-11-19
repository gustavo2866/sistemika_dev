"use client";

import { useRef, useState } from "react";
import { ListBase, ResourceContextProvider, useListContext, useRecordContext } from "ra-core";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListPaginator, ListText, ResponsiveDataTable, TextListColumn } from "@/components/forms/form_order";
import { ReferenceField } from "@/components/reference-field";
import { ErpCashMapCreate } from "./create";
import { ErpCashMapEdit } from "./edit";
import type { ErpCashMap } from "./model";

export type CashAccountMappingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountNumber: number;
  accountName: string;
  onSaved?: () => void | Promise<void>;
};

type MappingFormTarget = { mode: "create" } | { mode: "edit"; id: ErpCashMap["id"] };

const MappingAccountCell = ({ onEdit }: { onEdit: (id: ErpCashMap["id"]) => void }) => {
  const record = useRecordContext<ErpCashMap>();
  if (!record) return null;
  return (
    <button
      type="button"
      className="w-full rounded text-left hover:underline focus-visible:outline focus-visible:outline-2"
      onClick={(event) => { event.stopPropagation(); onEdit(record.id); }}
      aria-label={`Editar mapeo ${record.nro_cta}, ${record.categoria || "sin categoría"}`}
    >
      <span className="block font-medium tabular-nums">{record.nro_cta}</span>
      <span className="block text-[9px] text-muted-foreground">{record.cuenta_nombre}</span>
    </button>
  );
};

const AccountMappingsList = ({ accountNumber, accountName, onSaved }: Pick<CashAccountMappingsDialogProps, "accountNumber" | "accountName" | "onSaved">) => {
  const { isPending, error, refetch, total, setPage } = useListContext<ErpCashMap>();
  const [formTarget, setFormTarget] = useState<MappingFormTarget | null>(null);
  const formReturnFocusRef = useRef<HTMLElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const editMapping = (id: ErpCashMap["id"]) => setFormTarget({ mode: "edit", id });
  const closeForm = () => setFormTarget(null);
  const saved = () => {
    closeForm();
    setPage(1);
    void refetch();
    void onSaved?.();
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{total ?? 0} mapeos</span>
        <Button ref={addButtonRef} type="button" variant="outline" size="sm" onClick={() => setFormTarget({ mode: "create" })}>
          <Plus className="mr-1 size-3.5" /> Agregar
        </Button>
      </div>
      <div className="min-h-0 overflow-auto rounded-md border">
        {isPending ? (
          <div className="flex min-h-28 items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Cargando mapeos…
          </div>
        ) : error ? (
          <div className="space-y-2 p-4 text-center text-xs text-destructive">
            <p>{error instanceof Error ? error.message : "No se pudieron cargar los mapeos"}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>Reintentar</Button>
          </div>
        ) : (
          <ResponsiveDataTable<ErpCashMap>
            storeKey="cash-erp-account-mappings"
            compact
            bulkActionButtons={false}
            rowClick={(id) => { editMapping(id); return false; }}
            emptyMessage="Esta cuenta ERP no tiene mapeos."
            empty={<div className="p-4 text-center text-xs text-muted-foreground">Esta cuenta ERP no tiene mapeos.</div>}
            mobileConfig={{ primaryField: "nro_cta", secondaryFields: ["categoria"] }}
          >
            <TextListColumn source="nro_cta" label="Cuenta ERP" className="w-[240px]">
              <MappingAccountCell onEdit={editMapping} />
            </TextListColumn>
            <TextListColumn source="categoria" label="Categoría"><ListText source="categoria" /></TextListColumn>
            <TextListColumn source="map_debe_id" label="Debe">
              <ReferenceField source="map_debe_id" reference="erp/cash/cuentas" link={false}><ListText source="descripcion" /></ReferenceField>
            </TextListColumn>
            <TextListColumn source="map_haber_id" label="Haber">
              <ReferenceField source="map_haber_id" reference="erp/cash/cuentas" link={false}><ListText source="descripcion" /></ReferenceField>
            </TextListColumn>
          </ResponsiveDataTable>
        )}
      </div>
      <ListPaginator />

      <Dialog open={formTarget !== null} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent
          className="max-h-[88vh] !w-[94vw] !max-w-[760px] gap-2 overflow-y-auto p-4"
          onOpenAutoFocus={() => { formReturnFocusRef.current = document.activeElement as HTMLElement | null; }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const previous = formReturnFocusRef.current;
            if (previous?.isConnected) previous.focus();
            else addButtonRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-base">{formTarget?.mode === "edit" ? "Editar mapeo Cash" : "Crear mapeo Cash"}</DialogTitle>
            <DialogDescription>{accountNumber} — {accountName}</DialogDescription>
          </DialogHeader>
          {formTarget && <ResourceContextProvider value="erp/cash/maps">
            {formTarget.mode === "edit" ? (
              <ErpCashMapEdit key={formTarget.id} embedded id={formTarget.id} redirect={false} onCancel={closeForm} onSaved={saved} />
            ) : (
              <ErpCashMapCreate embedded redirect={false} initialValues={{ nro_cta: accountNumber }} onCancel={closeForm} onSaved={saved} />
            )}
          </ResourceContextProvider>}
        </DialogContent>
      </Dialog>
    </>
  );
};

export const CashAccountMappingsDialog = ({ open, onOpenChange, accountNumber, accountName, onSaved }: CashAccountMappingsDialogProps) => {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[84vh] !w-[94vw] !max-w-[920px] flex-col gap-3 p-4"
        onOpenAutoFocus={() => { returnFocusRef.current = document.activeElement as HTMLElement | null; }}
        onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusRef.current?.focus(); }}
      >
        <DialogHeader className="pr-6">
          <DialogTitle className="text-base">Mapeos de la cuenta ERP</DialogTitle>
          <DialogDescription>{accountNumber} — {accountName}</DialogDescription>
        </DialogHeader>
        {open && <ListBase
          resource="erp/cash/maps"
          filter={{ nro_cta: accountNumber }}
          sort={{ field: "id", order: "DESC" }}
          perPage={10}
          disableSyncWithLocation
          storeKey={false}
        >
          <AccountMappingsList accountNumber={accountNumber} accountName={accountName} onSaved={onSaved} />
        </ListBase>}
      </DialogContent>
    </Dialog>
  );
};
