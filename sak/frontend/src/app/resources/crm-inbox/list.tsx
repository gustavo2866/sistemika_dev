"use client";

import { useState } from "react";
import { useNotify, useRefresh, useDataProvider } from "ra-core";
import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { BadgeField } from "@/components/badge-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CRMInboxConfirmForm } from "./form";
import type { CRMMensaje } from "./model";

const ESTADO_CHOICES = [
  { id: "nuevo", name: "Nuevo" },
  { id: "confirmado", name: "Confirmado" },
  { id: "descartado", name: "Descartado" },
  { id: "pendiente_envio", name: "Pendiente envio" },
  { id: "enviado", name: "Enviado" },
  { id: "error_envio", name: "Error envio" },
];

const CANAL_CHOICES = [
  { id: "whatsapp", name: "WhatsApp" },
  { id: "email", name: "Email" },
  { id: "red_social", name: "Red social" },
  { id: "otro", name: "Otro" },
];

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar" alwaysOn className="w-full" />,
  <SelectInput key="estado" source="estado" label="Estado" choices={ESTADO_CHOICES} emptyText="Todos" alwaysOn />,
  <SelectInput key="canal" source="canal" label="Canal" choices={CANAL_CHOICES} emptyText="Todos" />,
  <ReferenceInput key="responsable_id" source="responsable_id" reference="users" label="Responsable">
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const CRMInboxList = () => {
  const [detailRecord, setDetailRecord] = useState<CRMMensaje | null>(null);
  const [confirmRecord, setConfirmRecord] = useState<CRMMensaje | null>(null);
  const [openDetail, setOpenDetail] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [busyLLM, setBusyLLM] = useState(false);
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const handleOpenDetail = (record: CRMMensaje) => {
    setDetailRecord(record);
    setOpenDetail(true);
  };

  const handleOpenConfirm = (record: CRMMensaje) => {
    setConfirmRecord(record);
    setOpenConfirm(true);
    setOpenDetail(false);
  };

  const handleConfirmSuccess = () => {
    setOpenConfirm(false);
    setConfirmRecord(null);
    refresh();
  };

  const handleDiscard = async () => {
    if (!detailRecord) return;
    try {
      await dataProvider.update("crm/mensajes", {
        id: detailRecord.id,
        data: { estado: "descartado" },
        previousData: detailRecord,
      });
      notify("Mensaje descartado", { type: "info" });
      setOpenDetail(false);
      refresh();
    } catch (e: any) {
      notify(e?.message || "No se pudo descartar", { type: "warning" });
    }
  };

  const handleLLM = async () => {
    if (!detailRecord) return;
    setBusyLLM(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch(`${apiBaseUrl}/crm/mensajes/${detailRecord.id}/llm-sugerir`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ force: true }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setDetailRecord((prev) =>
        prev
          ? {
              ...prev,
              metadata: {
                ...(prev.metadata ?? {}),
                llm_suggestions: data.llm_suggestions,
              },
            }
          : prev
      );
      notify("Sugerencias actualizadas", { type: "info" });
      refresh();
    } catch (e: any) {
      notify(e?.message || "No se pudo obtener sugerencias", { type: "warning" });
    } finally {
      setBusyLLM(false);
    }
  };

  return (
    <>
      <List
        filters={filters}
        actions={<ListActions />}
        perPage={10}
        debounce={300}
        filter={{ tipo: "entrada" }}
        filterDefaultValues={{ estado: "nuevo" }}
        sort={{ field: "created_at", order: "DESC" }}
      >
        <DataTable
          rowClick={(id, resource, record) => {
            handleOpenDetail(record as CRMMensaje);
            return false;
          }}
        >
          <DataTable.Col source="contacto_referencia" label="Referencia">
            <TextField source="contacto_referencia" className="max-w-[220px] break-words" />
          </DataTable.Col>
          <DataTable.Col source="asunto" label="Asunto">
            <TextField source="asunto" className="truncate max-w-[240px]" />
          </DataTable.Col>
          <DataTable.Col source="canal" label="Canal">
            <BadgeField source="canal" />
          </DataTable.Col>
          <DataTable.Col source="estado" label="Estado">
            <BadgeField source="estado" />
          </DataTable.Col>
        </DataTable>
      </List>

      <Dialog open={openDetail} onOpenChange={setOpenDetail}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle del mensaje</DialogTitle>
            <DialogDescription>{detailRecord?.asunto ?? "Mensaje seleccionado"}</DialogDescription>
          </DialogHeader>
          {detailRecord ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-semibold">Canal:</span> {detailRecord.canal}
                </div>
                <div>
                  <span className="font-semibold">Estado:</span> {detailRecord.estado}
                </div>
                <div>
                  <span className="font-semibold">Referencia:</span> {detailRecord.contacto_referencia || "-"}
                </div>
              </div>
              <div className="rounded-md border bg-white shadow-sm p-3">
                <div className="font-semibold mb-1">Asunto</div>
                <div className="text-sm">{detailRecord.asunto}</div>
              </div>
              <div className="rounded-md border bg-white shadow-sm p-3">
                <div className="font-semibold mb-1">Contenido</div>
                <div className="text-sm whitespace-pre-wrap">{detailRecord.contenido}</div>
              </div>
              {detailRecord.metadata?.llm_suggestions ? (
                <div className="rounded-md border bg-white shadow-sm p-3">
                  <div className="font-semibold mb-1">Sugerencias LLM</div>
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(detailRecord.metadata.llm_suggestions, null, 2)}
                  </pre>
                </div>
              ) : null}
              <div className="flex gap-2">
                {detailRecord.estado === "nuevo" ? (
                  <Button size="sm" onClick={() => handleOpenConfirm(detailRecord)}>
                    Confirmar
                  </Button>
                ) : null}
                {detailRecord.estado === "nuevo" ? (
                  <Button size="sm" variant="outline" onClick={handleDiscard}>
                    Descartar
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={handleLLM} disabled={busyLLM}>
                  {busyLLM ? "Generando..." : "Sugerencias LLM"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={openConfirm}
        onOpenChange={(open) => {
          setOpenConfirm(open);
          if (!open) {
            setConfirmRecord(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Confirmar mensaje</DialogTitle>
            <DialogDescription>Completa los pasos para confirmar el mensaje.</DialogDescription>
          </DialogHeader>
          {confirmRecord ? (
            <CRMInboxConfirmForm
              message={confirmRecord}
              onSuccess={handleConfirmSuccess}
              onCancel={() => setOpenConfirm(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

