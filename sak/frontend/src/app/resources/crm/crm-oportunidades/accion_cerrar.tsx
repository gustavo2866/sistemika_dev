"use client";

import { Target } from "lucide-react";
import { useMemo, useState } from "react";
import {
  required,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import { useWatch } from "react-hook-form";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import {
  FormReferenceAutocomplete,
  FormSelect,
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
import type { CRMOportunidad } from "./model";
import { AccionOportunidadHeader } from "./accion_header";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const normalizeId = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : null;
};

export const CRMOportunidadAccionCerrar = () => {
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

  const defaultValues = useMemo(
    () => ({
      resultado: "ganada",
      motivo_perdida_id: oportunidad?.motivo_perdida_id ?? "",
      descripcion_estado: oportunidad?.descripcion_estado ?? "",
    }),
    [oportunidad],
  );

  if (!Number.isFinite(oportunidadId) || isLoading) {
    return null;
  }

  return (
    <AccionCerrarContent
      returnTo={returnTo}
      oportunidadId={oportunidadId}
      oportunidad={oportunidad ?? null}
      defaultValues={defaultValues}
      dataProvider={dataProvider}
      notify={notify}
      refresh={refresh}
      navigate={navigate}
      usuarioId={Number(identity?.id) || 1}
    />
  );
};

export default CRMOportunidadAccionCerrar;

const AccionCerrarContent = ({
  returnTo,
  oportunidadId,
  oportunidad,
  defaultValues,
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
  dataProvider: ReturnType<typeof useDataProvider>;
  notify: ReturnType<typeof useNotify>;
  refresh: ReturnType<typeof useRefresh>;
  navigate: ReturnType<typeof useNavigate>;
  usuarioId: number;
}) => {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!oportunidadId) return;
    const descripcion = String(values.descripcion_estado ?? "").trim();
    const motivoPerdidaId = normalizeId(values.motivo_perdida_id);
    const resultado = String(values.resultado ?? "perdida");
    const nuevoEstado = resultado === "ganada" ? "5-ganada" : "6-perdida";
    if (!descripcion) {
      notify("La descripcion es obligatoria", { type: "warning" });
      return;
    }
    if (nuevoEstado === "6-perdida" && !motivoPerdidaId) {
      notify("El motivo de perdida es obligatorio", { type: "warning" });
      return;
    }
    try {
      setSaving(true);
      await dataProvider.create(`crm/oportunidades/${oportunidadId}/cambiar-estado`, {
        data: {
          nuevo_estado: nuevoEstado,
          descripcion,
          usuario_id: usuarioId,
          fecha_estado: new Date().toISOString(),
          ...(nuevoEstado === "6-perdida" ? { motivo_perdida_id: motivoPerdidaId } : {}),
        },
      });
      notify(
        nuevoEstado === "6-perdida"
          ? "Oportunidad cerrada como perdida"
          : "Oportunidad marcada como ganada",
        { type: "success" },
      );
      refresh();
      navigate(returnTo);
    } catch (error) {
      console.error(error);
      notify("No se pudo cerrar la oportunidad", { type: "error" });
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
            Cerrar oportunidad
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs">
            Completa el motivo y notas de cierre.
          </DialogDescription>
        </DialogHeader>
        <SimpleForm
          className="w-full"
          key={oportunidadId}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          toolbar={null}
        >
          <div className="space-y-3">
            <AccionOportunidadHeader oportunidad={oportunidad} compact />
            <SectionBaseTemplate
              title="Cierre"
              defaultOpen
              main={<AccionCerrarFields />}
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
              variant="destructive"
              disabled={saving}
              className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
            >
              {saving ? "Cerrando..." : "Cerrar"}
            </Button>
          </DialogFooter>
        </SimpleForm>
      </DialogContent>
    </Dialog>
  );
};

const AccionCerrarFields = () => {
  const resultadoValue = useWatch({ name: "resultado" }) as string | undefined;
  const isPerdida = (resultadoValue ?? "perdida") === "perdida";

  return (
    <div className="grid gap-2 md:grid-cols-12">
      <FormSelect
        source="resultado"
        label="Resultado"
        optionText="name"
        optionValue="id"
        choices={[
          { id: "ganada", name: "Ganada" },
          { id: "perdida", name: "Perdida" },
        ]}
        validate={required()}
        widthClass="w-full md:col-span-6"
      />
      {isPerdida ? (
        <FormReferenceAutocomplete
          referenceProps={{
            source: "motivo_perdida_id",
            reference: "crm/catalogos/motivos-perdida",
          }}
          inputProps={{
            optionText: "nombre",
            label: "Motivo",
            validate: required(),
          }}
          widthClass="w-full md:col-span-6"
        />
      ) : null}
      <FormTextarea
        source="descripcion_estado"
        label="Notas"
        validate={required()}
        widthClass="w-full md:col-span-12"
        className="[&_textarea]:min-h-[64px]"
      />
    </div>
  );
};

