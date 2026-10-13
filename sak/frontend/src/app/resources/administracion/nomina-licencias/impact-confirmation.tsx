"use client";

import { useState } from "react";
import { useNotify, useSaveContext } from "ra-core";
import { useFormContext } from "react-hook-form";
import { LoaderCircle } from "lucide-react";

import { Confirm } from "@/components/confirm";
import { FormOrderSaveButton } from "@/components/forms";

import {
  validateNominaLicenciaPayload,
  type CoberturaLicenciaResponse,
} from "./model";

const ACTION_LABELS = {
  agregar: "Agregar novedad de licencia",
  actualizar: "Actualizar datos de la novedad",
  actualizar_tipo: "Actualizar tipo de licencia",
  actualizar_periodo: "Actualizar período o comentario",
  eliminar: "Quitar novedad de licencia",
  reemplazar: "Reemplazar novedad existente",
  sin_cambios: "Sin cambios",
} as const;

const formatDate = (value: unknown) => {
  const text = String(value ?? "");
  const [year, month, day] = text.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : text;
};

export const NominaLicenciaImpactContent = ({
  validacion,
  operacion,
  payload,
  processing = false,
}: {
  validacion: CoberturaLicenciaResponse;
  operacion: "guardar" | "eliminar";
  payload?: Record<string, unknown>;
  processing?: boolean;
}) => (
  <div className="space-y-3 text-sm">
    {processing ? (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-primary"
      >
        <LoaderCircle className="size-5 shrink-0 animate-spin" />
        <div>
          <p className="font-medium">Trabajo en proceso</p>
          <p className="text-xs text-muted-foreground">
            Guardando la licencia y sincronizando los partes diarios. Por favor,
            esperá a que finalice.
          </p>
        </div>
      </div>
    ) : null}

    {validacion.estado === "bloqueada" ? (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
        <p className="font-medium">No se puede continuar</p>
        <p className="mt-1 text-xs">{validacion.mensaje}</p>
        <ul className="mt-2 space-y-1 text-xs">
          {validacion.tarjas_cerradas.map((tarja) => (
            <li key={`${tarja.tarja_id}-${tarja.fecha_desde}-${tarja.fecha_hasta}`}>
              Tarja #{tarja.tarja_id}: período {formatDate(tarja.fecha_desde)} a{" "}
              {formatDate(tarja.fecha_hasta)}
            </li>
          ))}
        </ul>
      </div>
    ) : null}

    <p className="text-muted-foreground">
      {operacion === "eliminar"
        ? "Se eliminará la licencia y se resincronizarán los registros relacionados."
        : `${payload?.id ? "Se actualizará" : "Se creará"} la licencia ${String(payload?.tipo_novedad ?? "").trim()} del ${formatDate(payload?.fecha_desde)} al ${payload?.fecha_hasta ? formatDate(payload.fecha_hasta) : "sin fecha hasta"}.`}
    </p>

    {validacion.impacto.length ? (
      <div>
        <p className="mb-1 font-medium">Cambios en partes diarios:</p>
        <ul className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
          {validacion.impacto.map((item) => (
            <li
              key={`${item.accion}-${item.parte_diario_id}-${item.fecha}`}
              className="rounded-sm px-1 py-0.5"
            >
              <div>
                <span className="font-medium">{formatDate(item.fecha)}</span>
                {" · "}
                Parte #{item.parte_diario_id}: {ACTION_LABELS[item.accion]}
              </div>
              {item.accion === "reemplazar" ||
              item.accion === "eliminar" ||
              item.accion === "actualizar_tipo" ||
              item.accion === "actualizar_periodo" ? (
                <div className="pl-3 text-muted-foreground">
                  Actual: {item.novedad_anterior ?? "Novedad sin tipo"}
                  {item.descripcion_anterior
                    ? ` — ${item.descripcion_anterior}`
                    : ""}
                </div>
              ) : null}
              {item.novedad_nueva &&
              (item.accion === "agregar" ||
                item.accion === "reemplazar" ||
                item.accion === "actualizar" ||
                item.accion === "actualizar_tipo") ? (
                <div className="pl-3 font-medium">
                  Nueva: {item.novedad_nueva}
                </div>
              ) : null}
              {item.accion === "actualizar_periodo" && item.descripcion_nueva ? (
                <div className="pl-3 font-medium">
                  Nueva descripción: {item.descripcion_nueva}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    ) : (
      <p className="rounded-md border p-2 text-xs text-muted-foreground">
        No se modificarán partes diarios existentes.
      </p>
    )}

    {validacion.novedades_conflictivas.length ? (
      <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
        {validacion.novedades_conflictivas.length} novedad
        {validacion.novedades_conflictivas.length === 1 ? "" : "es"} existente
        {validacion.novedades_conflictivas.length === 1 ? " será reemplazada" : "s serán reemplazadas"}.
      </p>
    ) : null}
  </div>
);

type PendingConfirmation = {
  payload: Record<string, unknown>;
  validacion: CoberturaLicenciaResponse;
};

export const NominaLicenciaSaveButton = () => {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [loading, setLoading] = useState(false);
  const form = useFormContext();
  const saveContext = useSaveContext();
  const notify = useNotify();

  const handlePreview = form.handleSubmit(async (data) => {
    setLoading(true);
    try {
      const { payload, validacion } = await validateNominaLicenciaPayload(data);
      setPending({ payload, validacion });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "No se pudo validar la licencia",
        { type: "warning" },
      );
    } finally {
      setLoading(false);
    }
  });

  const handleConfirm = async () => {
    if (
      !pending ||
      pending.validacion.estado === "bloqueada" ||
      !saveContext?.save
    ) {
      return;
    }
    setLoading(true);
    const payload = { ...pending.payload };
    if (pending.validacion.novedades_conflictivas.length) {
      payload._reemplazar_novedades = true;
    }
    try {
      await saveContext.save(payload);
      setPending(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <FormOrderSaveButton
        type="button"
        disabled={loading}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void handlePreview();
        }}
      />
      <Confirm
        isOpen={Boolean(pending)}
        onClose={() => {
          if (!loading) setPending(null);
        }}
        onConfirm={() => void handleConfirm()}
        title={
          pending?.validacion.estado === "bloqueada"
            ? "Licencia bloqueada por tarjas cerradas"
            : "Confirmar impacto de la licencia"
        }
        content={
          pending ? (
            <NominaLicenciaImpactContent
              operacion="guardar"
              payload={pending.payload}
              validacion={pending.validacion}
              processing={loading}
            />
          ) : null
        }
        confirm={loading ? "Guardando y sincronizando..." : "Guardar y sincronizar"}
        cancel={pending?.validacion.estado === "bloqueada" ? "Cerrar" : undefined}
        confirmDisabled={pending?.validacion.estado === "bloqueada"}
        loading={loading}
      />
    </>
  );
};
