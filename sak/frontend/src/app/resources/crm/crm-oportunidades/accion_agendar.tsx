"use client";

import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  required,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import { Calendar } from "lucide-react";
import { SimpleForm } from "@/components/simple-form";
import {
  FormReferenceAutocomplete,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccionOportunidadHeader } from "./accion_header";

const normalizeId = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : null;
};

export const CRMOportunidadAccionAgendar = () => {
  const { id } = useParams();
  const oportunidadId = Number(id);
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const location = useLocation();
  const navigate = useNavigate();
  const { identity } = useGetIdentity();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "/crm/oportunidades";
  const [saving, setSaving] = useState(false);

  const { data: oportunidad, isLoading } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadId },
    { enabled: Number.isFinite(oportunidadId) }
  );

  const defaultValues = useMemo(
    () => ({
      titulo: oportunidad?.titulo ? `Visita ${oportunidad.titulo}` : "",
      descripcion: "",
      tipo_evento_id: "",
      fecha: "",
      asignado_id: identity?.id ?? "",
    }),
    [oportunidad, identity]
  );

  if (!Number.isFinite(oportunidadId) || isLoading) {
    return null;
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!oportunidadId) return;
    setSaving(true);
    try {
      await dataProvider.create("crm/crm-eventos", {
        data: {
          titulo: (values as any).titulo,
          descripcion: (values as any).descripcion,
          tipo_id: normalizeId((values as any).tipo_evento_id),
          asignado_a_id: normalizeId((values as any).asignado_id),
          fecha_evento: (values as any).fecha,
          contacto_id: oportunidad?.contacto_id,
          oportunidad_id: oportunidadId,
          estado: 1,
        },
      });

      const descripcion =
        String((values as any).descripcion ?? "").trim() || "Visita agendada";
      await dataProvider.create(`crm/oportunidades/${oportunidadId}/cambiar-estado`, {
        data: {
          nuevo_estado: "2-visita",
          descripcion,
          usuario_id: identity?.id ?? 1,
          fecha_estado: new Date().toISOString(),
        },
      });

      notify("Visita agendada exitosamente", { type: "success" });
      refresh();
      navigate(returnTo);
    } catch (error: any) {
      notify(error.message || "Error al agendar la visita", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? navigate(returnTo) : null)}>
      <DialogContent
        className="sm:max-w-sm"
        overlayClassName="!bg-transparent !backdrop-blur-0"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Agendar visita
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs">
            Crea el evento y actualiza el estado.
          </DialogDescription>
        </DialogHeader>
        <SimpleForm
          key={oportunidadId}
          defaultValues={defaultValues}
          className="w-full"
          onSubmit={handleSubmit}
          toolbar={null}
        >
          <div className="space-y-3">
            <AccionOportunidadHeader oportunidad={oportunidad ?? null} compact />
            <SectionBaseTemplate
              title="Agenda"
              defaultOpen
              main={
                <div className="grid gap-2 md:grid-cols-12">
                  <FormText
                    source="titulo"
                    label="Titulo"
                    validate={required()}
                    widthClass="w-full md:col-span-12"
                  />
                  <FormReferenceAutocomplete
                    referenceProps={{
                      source: "tipo_evento_id",
                      reference: "crm/catalogos/tipos-evento",
                    }}
                    inputProps={{
                      optionText: "nombre",
                      label: "Tipo",
                      validate: required(),
                    }}
                    widthClass="w-full md:col-span-6"
                  />
                  <FormText
                    source="fecha"
                    label="Fecha y hora"
                    type="datetime-local"
                    validate={required()}
                    widthClass="w-full md:col-span-6"
                  />
                  <FormReferenceAutocomplete
                    referenceProps={{ source: "asignado_id", reference: "users" }}
                    inputProps={{
                      optionText: "nombre",
                      label: "Asignado a",
                      validate: required(),
                    }}
                    widthClass="w-full md:col-span-6"
                  />
                  <FormTextarea
                    source="descripcion"
                    label="Descripcion"
                    widthClass="w-full md:col-span-12"
                    className="[&_textarea]:min-h-[64px]"
                  />
                </div>
              }
            />
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(returnTo)}
              disabled={saving}
              className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm">
              {saving ? "Agendando..." : "Agendar visita"}
            </Button>
          </DialogFooter>
        </SimpleForm>
      </DialogContent>
    </Dialog>
  );
};

export default CRMOportunidadAccionAgendar;

