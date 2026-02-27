"use client";

import { Target } from "lucide-react";
import { useMemo, useState } from "react";
import {
  required,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import { useWatch } from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FormReferenceAutocomplete,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import type { CRMOportunidad } from "./model";
import { AccionOportunidadHeader } from "./accion_header";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const normalizeId = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : null;
};

const resolveNumericId = (value: unknown): number | undefined => {
  if (value == null) return undefined;
  if (typeof value === "object") {
    const maybeId = (value as { id?: unknown; value?: unknown }).id ??
      (value as { value?: unknown }).value;
    return resolveNumericId(maybeId);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "0") return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  return undefined;
};

export const CRMOportunidadAccionAceptar = () => {
  const { id } = useParams();
  const oportunidadId = Number(id);
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const location = useLocation();
  const navigate = useNavigate();
  const { identity } = useGetIdentity();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "/crm/oportunidades";

  const { data: oportunidad, isLoading } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadId },
    { enabled: Number.isFinite(oportunidadId) },
  );
  const { data: tiposOperacion = [] } = useGetList(
    "crm/catalogos/tipos-operacion",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "nombre", order: "ASC" },
    },
  );
  const mantenimientoIds = useMemo(() => {
    return new Set(
      (tiposOperacion as any[])
        .filter((tipo) => {
          const key = String(tipo?.codigo ?? tipo?.nombre ?? "").toLowerCase();
          return key.includes("mantenimiento");
        })
        .map((tipo) => Number(tipo.id))
        .filter((id) => Number.isFinite(id)),
    );
  }, [tiposOperacion]);

  const defaultValues = useMemo(
    () => ({
      titulo: oportunidad?.titulo ?? "",
      tipo_operacion_id: oportunidad?.tipo_operacion_id ?? "",
      tipo_propiedad_id: oportunidad?.tipo_propiedad_id ?? "",
      propiedad_id: oportunidad?.propiedad_id ?? "",
      emprendimiento_id: oportunidad?.emprendimiento_id ?? "",
      descripcion_estado: oportunidad?.descripcion_estado ?? "",
    }),
    [oportunidad],
  );

  if (!Number.isFinite(oportunidadId) || isLoading) {
    return null;
  }

  return (
    <AccionAceptarContent
      returnTo={returnTo}
      oportunidadId={oportunidadId}
      oportunidad={oportunidad ?? null}
      defaultValues={defaultValues}
      mantenimientoIds={mantenimientoIds}
      dataProvider={dataProvider}
      notify={notify}
      refresh={refresh}
      navigate={navigate}
      usuarioId={Number(identity?.id) || 1}
    />
  );
};

export default CRMOportunidadAccionAceptar;

const AccionAceptarContent = ({
  returnTo,
  oportunidadId,
  oportunidad,
  defaultValues,
  mantenimientoIds,
  dataProvider,
  notify,
  refresh,
  navigate,
  usuarioId,
}: {
  returnTo: string;
  oportunidadId: number;
  oportunidad: CRMOportunidad | null;
  defaultValues: Record<string, unknown>;
  mantenimientoIds: Set<number>;
  dataProvider: ReturnType<typeof useDataProvider>;
  notify: ReturnType<typeof useNotify>;
  refresh: ReturnType<typeof useRefresh>;
  navigate: ReturnType<typeof useNavigate>;
  usuarioId: number;
}) => {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!oportunidadId) return;
    try {
      const descripcion = String(values.descripcion_estado ?? "").trim();
      if (!descripcion) {
        notify("La descripcion es obligatoria", { type: "warning" });
        return;
      }
      setSaving(true);
      await dataProvider.update("crm/oportunidades", {
        id: oportunidadId,
        data: {
          titulo: (values.titulo as string | undefined)?.trim() ?? null,
          tipo_operacion_id: normalizeId(values.tipo_operacion_id),
          tipo_propiedad_id: normalizeId(values.tipo_propiedad_id),
          propiedad_id: normalizeId(values.propiedad_id),
          emprendimiento_id: normalizeId(values.emprendimiento_id),
        },
        previousData: oportunidad ?? undefined,
      });

      await dataProvider.create(`crm/oportunidades/${oportunidadId}/cambiar-estado`, {
        data: {
          nuevo_estado: "1-abierta",
          descripcion,
          usuario_id: usuarioId,
          fecha_estado: new Date().toISOString(),
        },
      });

      notify("Oportunidad confirmada y movida a Abierta", { type: "success" });
      refresh();
      navigate(returnTo);
    } catch (error) {
      console.error(error);
      notify("No se pudo confirmar la oportunidad", { type: "error" });
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
            <Target className="h-4 w-4" />
            Confirmar oportunidad
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs">
            Ajusta los datos principales antes de confirmar.
          </DialogDescription>
        </DialogHeader>
        <SimpleForm
          className="w-full"
          defaultValues={defaultValues}
          key={oportunidadId}
          onSubmit={handleSubmit}
          toolbar={null}
        >
          <div className="space-y-3">
            <AccionOportunidadHeader oportunidad={oportunidad} compact />
            <SectionBaseTemplate
              title="Confirmacion"
              defaultOpen
              main={
                <div className="text-[11px] sm:text-xs">
                  <AccionAceptarFields mantenimientoIds={mantenimientoIds} />
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
            <Button
              type="submit"
              disabled={saving}
              className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
            >
              {saving ? "Confirmando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </SimpleForm>
      </DialogContent>
    </Dialog>
  );
};

const AccionAceptarFields = ({ mantenimientoIds }: { mantenimientoIds: Set<number> }) => {
  const tipoOperacionValue = useWatch({ name: "tipo_operacion_id" }) as unknown;
  const resolvedTipoOperacionId = resolveNumericId(tipoOperacionValue);
  const isMantenimiento = resolvedTipoOperacionId
    ? mantenimientoIds.has(Number(resolvedTipoOperacionId))
    : false;

  const validatePropiedad = useMemo(
    () => (value: unknown, allValues: Record<string, unknown>) => {
      const tipoId = resolveNumericId(allValues?.tipo_operacion_id);
      if (tipoId && mantenimientoIds.has(Number(tipoId))) {
        return resolveNumericId(value) ? undefined : "Propiedad obligatoria";
      }
      return undefined;
    },
    [mantenimientoIds],
  );
  const propiedadValidators = useMemo(
    () => (isMantenimiento ? [required(), validatePropiedad] : validatePropiedad),
    [isMantenimiento, validatePropiedad],
  );

  return (
    <div className="grid gap-2 md:grid-cols-12">
      <FormText
        source="titulo"
        label="Titulo"
        validate={required()}
        widthClass="w-full md:col-span-6"
      />
      <ReferenceInput
        source="tipo_operacion_id"
        reference="crm/catalogos/tipos-operacion"
        label="Tipo de operacion"
      >
        <SelectInput
          optionText="nombre"
          emptyText="Seleccionar"
          validate={required()}
          className="text-[11px] [&_[data-slot=select-trigger]]:h-7 [&_[data-slot=select-trigger]]:px-2 [&_[data-slot=select-trigger]]:text-[11px] [&_[data-slot=form-label]]:text-[10px]"
        />
      </ReferenceInput>
      <FormReferenceAutocomplete
        referenceProps={{
          source: "emprendimiento_id",
          reference: "emprendimientos",
        }}
        inputProps={{
          optionText: "nombre",
          label: "Emprendimiento",
        }}
        widthClass="w-full md:col-span-6"
      />
      <ReferenceInput
        source="tipo_propiedad_id"
        reference="tipos-propiedad"
        label="Tipo de propiedad"
      >
        <SelectInput
          optionText="nombre"
          emptyText="Seleccionar"
          validate={required()}
          className="text-[11px] [&_[data-slot=select-trigger]]:h-7 [&_[data-slot=select-trigger]]:px-2 [&_[data-slot=select-trigger]]:text-[11px] [&_[data-slot=form-label]]:text-[10px]"
        />
      </ReferenceInput>
      {isMantenimiento ? (
        <FormReferenceAutocomplete
          referenceProps={{
            source: "propiedad_id",
            reference: "propiedades",
          }}
          inputProps={{
            optionText: "nombre",
            label: "Propiedad",
            validate: propiedadValidators,
          }}
          widthClass="w-full md:col-span-12"
        />
      ) : null}
      <FormTextarea
        source="descripcion_estado"
        label="Descripcion"
        validate={required()}
        widthClass="w-full md:col-span-12"
        className="[&_textarea]:min-h-[64px]"
      />
    </div>
  );
};


