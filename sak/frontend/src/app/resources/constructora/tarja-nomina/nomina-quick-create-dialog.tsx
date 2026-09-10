"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ResourceContextProvider, required, useDataProvider, useNotify } from "ra-core";
import { z } from "zod";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormErrorSummary,
  FormReferenceAutocomplete,
  FormText,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CreatedNomina = {
  id: number | string;
  nombre?: string | null;
  apellido?: string | null;
  dni?: string | null;
  nomina_categoria_id?: number | null;
  nomina_tarea_id?: number | null;
  idproyecto?: number | null;
  encargado_contacto_id?: number | null;
};

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const optionalId = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional(),
);

const quickNominaSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  apellido: z.string().trim().min(1).max(120),
  dni: z.string().trim().min(1).max(20),
  nomina_categoria_id: optionalId,
  nomina_tarea_id: optionalId,
});

type QuickNominaFormValues = z.infer<typeof quickNominaSchema>;

const QUICK_NOMINA_DEFAULT: QuickNominaFormValues = {
  nombre: "",
  apellido: "",
  dni: "",
  nomina_categoria_id: undefined,
  nomina_tarea_id: undefined,
};

const DUPLICATE_ACTIVE_DNI_MESSAGE = "Ya existe un empleado activo con ese DNI";

const normalizeQuickNominaPayload = (values: Record<string, unknown>) => ({
  nombre: String(values.nombre ?? "").trim(),
  apellido: String(values.apellido ?? "").trim(),
  dni: String(values.dni ?? "").trim(),
  nomina_categoria_id:
    values.nomina_categoria_id == null || values.nomina_categoria_id === ""
      ? null
      : Number(values.nomina_categoria_id),
  nomina_tarea_id:
    values.nomina_tarea_id == null || values.nomina_tarea_id === ""
      ? null
      : Number(values.nomina_tarea_id),
  idproyecto: null,
  encargado_contacto_id: null,
  fecha_ingreso: null,
  fecha_egreso: null,
  activo: true,
});

const getErrorMessage = (error: unknown) => {
  const err = error as {
    body?: { detail?: unknown; error?: { message?: string }; message?: string };
    message?: string;
  };
  const detail = err.body?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const detailObj = detail as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof detailObj.error === "string") return detailObj.error;
    return detailObj.error?.message || detailObj.message || JSON.stringify(detail);
  }
  return err.body?.error?.message || err.body?.message || err.message;
};

export const NominaQuickCreateDialog = ({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (record: CreatedNomina) => void | Promise<void>;
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      const payload = normalizeQuickNominaPayload(values);
      const existing = await dataProvider.getList<CreatedNomina>("nominas", {
        filter: { dni: payload.dni, activo: true },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      });
      if (existing.data[0]) {
        notify(`${DUPLICATE_ACTIVE_DNI_MESSAGE}: ${payload.dni}`, { type: "error" });
        return;
      }
      const response = await dataProvider.create<CreatedNomina>("nominas", {
        data: payload,
      });
      await onCreated(response.data);
      notify("Empleado creado", { type: "success" });
    } catch (error) {
      notify(
        getErrorMessage(error) || "No se pudo crear el empleado",
        { type: "error" },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar empleado</DialogTitle>
          <DialogDescription>
            Alta minima del empleado sin asignacion a una obra.
          </DialogDescription>
        </DialogHeader>
        <ResourceContextProvider value="nominas">
          <SimpleForm<QuickNominaFormValues>
            className="w-full max-w-none"
            resolver={zodResolver(quickNominaSchema) as any}
            defaultValues={QUICK_NOMINA_DEFAULT}
            onSubmit={handleSubmit}
            toolbar={
              <FormOrderToolbar
                cancelProps={{ onClick: onClose }}
                saveProps={{ alwaysEnable: true }}
              />
            }
          >
            <FormErrorSummary />
            <div className="grid gap-2 md:grid-cols-3">
              <FormText
                source="nombre"
                label="Nombre"
                validate={required()}
                widthClass="w-full"
              />
              <FormText
                source="apellido"
                label="Apellido"
                validate={required()}
                widthClass="w-full"
              />
              <FormText
                source="dni"
                label="DNI"
                validate={required()}
                widthClass="w-full"
              />
              <FormReferenceAutocomplete
                referenceProps={{
                  source: "nomina_categoria_id",
                  reference: "nomina-categorias",
                  filter: { activa: true },
                }}
                inputProps={{
                  optionText: "descripcion",
                  label: "Categoria",
                  placeholder: "Seleccionar",
                }}
                widthClass="w-full"
              />
              <FormReferenceAutocomplete
                referenceProps={{
                  source: "nomina_tarea_id",
                  reference: "nomina-tareas",
                  filter: { activa: true },
                }}
                inputProps={{
                  optionText: "descripcion",
                  label: "Actividad",
                  placeholder: "Seleccionar",
                }}
                widthClass="w-full"
              />
            </div>
          </SimpleForm>
        </ResourceContextProvider>
      </DialogContent>
    </Dialog>
  );
};
