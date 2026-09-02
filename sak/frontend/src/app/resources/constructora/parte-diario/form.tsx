"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  required,
  useCreatePath,
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useResourceContext,
  useSaveContext,
  useWrappedSource,
  setSubmissionErrors,
  type SaveHandlerCallbacks,
} from "ra-core";
import { useCallback, useEffect, useState } from "react";
import {
  useFormContext,
  useFormState,
  useWatch,
  type FieldValues,
  type UseFormSetError,
} from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { CheckCircle, CheckCircle2, Loader2, PlusCircle, Save } from "lucide-react";
import { Confirm } from "@/components/confirm";
import { FormOrderCancelButton, FormOrderSaveButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
  DetailFieldCell,
  FORM_FIELD_READONLY_CLASS,
  FormDate,
  FormErrorSummary,
  FormReferenceAutocomplete,
  FormNumber,
  FormSelectFijo,
  FormText,
  FormOrderHeaderMenuActions,
  resolveNumericId,
  SectionDetailColumn,
  SectionDetailFieldsProps,
  SectionDetailTemplate2,
  SectionBaseTemplate,
  useConfirmDelete,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";
import {
  PARTE_DIARIO_DEFAULTS,
  getParteDiarioDetalleDefaults,
  normalizeParteDiarioPayload,
  parteDiarioSchema,
  VALIDATION_RULES,
  type ParteDiarioRecord,
  type ParteDiarioFormValues,
} from "./model";

const buildAuthHeaders = () => {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  if (typeof window === "undefined") return headers;
  const token = window.localStorage.getItem("auth_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
};

const extractActionErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json();
    const detail = payload?.detail;
    if (typeof detail === "string") return detail;
    if (typeof detail?.error?.message === "string") return detail.error.message;
    if (typeof payload?.message === "string") return payload.message;
  } catch {
    // Keep generic message.
  }
  return "No se pudo completar la accion";
};

const fetchParteTarjaStatus = async (parteId: number | string, signal?: AbortSignal) => {
  const response = await fetch(`${apiUrl}/parte-diario/${parteId}/tarja`, {
    cache: "no-store",
    headers: buildAuthHeaders(),
    signal,
  });
  if (!response.ok) {
    throw new Error(await extractActionErrorMessage(response));
  }
  return (await response.json()) as { exists: boolean; tarja_id?: number | null };
};

const postRegenerarTarjaParte = async (parteId: number | string) => {
  const response = await fetch(`${apiUrl}/parte-diario/${parteId}/registrar-tarja`, {
    method: "POST",
    headers: buildAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await extractActionErrorMessage(response));
  }
  return response.json();
};

const getNominaLabel = (record?: Record<string, unknown>) => {
  if (!record) return "";
  const proyecto = record.proyecto as { nombre?: string | null } | null | undefined;
  const nombre = [record.nombre, record.apellido]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .trim();
  const empleado = nombre || (typeof record.dni === "string" ? record.dni : "");
  const obra = proyecto?.nombre?.trim().slice(0, 5);
  return obra ? `${empleado} (${obra})` : empleado;
};

const ParteDiarioMainFields = () => (
  <div className="grid gap-2 md:grid-cols-[190px_210px_120px] md:items-start">
    <ReferenceInput source="idproyecto" reference="proyectos" label="Proyecto">
      <FormSelectFijo
        optionText="nombre"
        fixedWidth="190px"
        widthClass="w-full md:w-[190px]"
        emptyText="Seleccionar"
        validate={required()}
      />
    </ReferenceInput>
    <ReferenceInput source="contacto_id" reference="crm/contactos" label="Contacto">
      <FormSelectFijo
        optionText="nombre_completo"
        fixedWidth="210px"
        widthClass="w-full md:w-[210px]"
        emptyText="Sin contacto"
      />
    </ReferenceInput>
    <FormDate
      source="fecha"
      label="Fecha"
      validate={required()}
      widthClass="w-full md:w-[120px]"
    />
  </div>
);

const ParteDiarioOptionalFields = () => (
  <div className="mt-1 rounded-md border border-muted/60 bg-muted/30 p-2">
    <FormText
      source="descripcion"
      label="Descripcion"
      widthClass="w-full md:w-[260px]"
      maxLength={VALIDATION_RULES.DESCRIPCION.MAX_LENGTH}
    />
  </div>
);

const ParteDiarioHeaderSection = ({ returnTo }: { returnTo?: string | null }) => {
  const record = useRecordContext<ParteDiarioRecord>();
  const resource = useResourceContext();
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const canDelete = Boolean(record?.id && resource);
  const { confirmDelete, setConfirmDelete, deleting, handleDelete } = useConfirmDelete({
    record,
    resource,
    onSuccess: () => {
      if (returnTo) {
        navigate(returnTo, { replace: true });
        return;
      }
      if (resource) {
        navigate(createPath({ resource, type: "list" }));
      }
    },
  });

  return (
    <>
      <SectionBaseTemplate
        title="Informacion general"
        main={<ParteDiarioMainFields />}
        optional={<ParteDiarioOptionalFields />}
        actions={
          canDelete ? (
            <FormOrderHeaderMenuActions
              canDelete
              onDelete={() => setConfirmDelete(true)}
            />
          ) : null
        }
        defaultOpen
      />
      {canDelete ? (
        <Confirm
          isOpen={confirmDelete}
          loading={deleting}
          title="Eliminar registro"
          content="Seguro que deseas eliminar este registro?"
          confirm="Eliminar"
          confirmColor="warning"
          cancel="Cancelar"
          overlayClassName="bg-transparent backdrop-blur-0"
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      ) : null}
    </>
  );
};

const ParteDiarioDetalleFields = () => {
  const [addRequestSignal, setAddRequestSignal] = useState(0);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const columns: SectionDetailColumn[] = [
    { label: "Empleado", width: "180px", mobileSpan: "full" },
    { label: "Horas", width: "54px" },
    { label: "Estado", width: "122px" },
    { label: "Descripcion", width: "minmax(150px,1fr)", mobileSpan: "full" },
    { label: "", width: "minmax(54px,auto)" },
  ];

  const DetalleCamposPrincipales = useCallback(
    (props: SectionDetailFieldsProps) => <ParteDiarioDetalleMainFields {...props} />,
    [],
  );

  return (
    <div className="flex flex-col gap-0">
      <SectionDetailTemplate2
        title="Detalle de horas"
        mainColumns={columns}
        mainFields={DetalleCamposPrincipales}
        defaults={getParteDiarioDetalleDefaults}
        maxHeightClassName="md:h-36 md:min-h-36 md:max-h-36"
        saveOnlyWhenActive
        showDeleteWhenInactive
        showExpandActionOnMobile
        showExpandAction={false}
        showInfoAction={false}
        addButtonLabel="Agregar novedad"
        addRequestSignal={addRequestSignal}
        hideFooterAddButton
        onActiveRowChange={setActiveRowIndex}
        cardClassName="pb-0"
        detailContainerClassName="px-1 pb-0"
        detailIteratorClassName={
          "[&_li]:!border-b [&_li]:!border-slate-200/70 [&_li:last-child]:!border-b-0 " +
          "[&_li]:!min-h-0 [&_li]:!py-0 " +
          "[&_[data-focus-scope=detail-row]]:text-[8px] " +
          "[&_[data-focus-scope=detail-row]]:sm:text-[9px] " +
          "[&_[data-focus-scope=detail-row]]:!py-0 " +
          "[&_[data-focus-scope=detail-row]>div]:!gap-0.5 " +
          "[&_[data-focus-scope=detail-row]>div>div]:sm:!gap-1 " +
          "[&_[data-focus-scope=detail-row].is-active]:sm:!border-0 " +
          "[&_[data-focus-scope=detail-row].is-active]:sm:!ring-1 " +
          "[&_[data-focus-scope=detail-row].is-active]:sm:!ring-inset " +
          "[&_[data-focus-scope=detail-row].is-active]:sm:!ring-primary/30 " +
          "[&_[data-focus-scope=detail-row].is-active]:sm:!p-0.5 " +
          "[&_[data-focus-scope=detail-row].is-active]:sm:!py-[3px]"
        }
      />
      <ParteDiarioResumenTotales
        addDisabled={activeRowIndex != null}
        onAdd={() => setAddRequestSignal((current) => current + 1)}
      />
    </div>
  );
};

const ParteDiarioDetalleMainFields = ({ isActive }: SectionDetailFieldsProps) => {
  const descripcionSource = useWrappedSource("descripcion");
  const descripcion = useWatch({ name: descripcionSource }) as string | undefined;
  const proyectoValue = useWatch({ name: "idproyecto" });
  const contactoValue = useWatch({ name: "contacto_id" });
  const proyectoId = resolveNumericId(proyectoValue);
  const contactoId = resolveNumericId(contactoValue);
  const hasDescripcion = Boolean(descripcion?.trim());
  const readOnlyClassName = !isActive ? FORM_FIELD_READONLY_CLASS : undefined;
  const nominaFilter = {
    activo: true,
    ...(proyectoId ? { idproyecto: proyectoId } : {}),
    ...(contactoId ? { encargado_contacto_id: contactoId } : {}),
  };

  return (
    <>
      <DetailFieldCell label="Empleado" data-focus-field="true">
        <div className="flex w-[180px] items-center">
          <FormReferenceAutocomplete
            referenceProps={{
              source: "idnomina",
              reference: "nominas",
              filter: nominaFilter,
              sort: { field: "apellido", order: "ASC" },
            }}
            inputProps={{
              optionText: getNominaLabel,
              inputText: getNominaLabel,
              label: false,
              validate: required(),
              placeholder: "Seleccionar",
            }}
            widthClass={isActive ? "w-[144px]" : "w-[180px]"}
            className={cn(
              "[&_button[role=combobox]]:h-3.5 [&_button[role=combobox]]:px-0.5 [&_button[role=combobox]]:py-0 [&_button[role=combobox]]:text-[8px] " +
                "sm:[&_button[role=combobox]]:h-4 sm:[&_button[role=combobox]]:px-1 sm:[&_button[role=combobox]]:text-[9px] " +
                "[&_button[role=combobox]>span]:text-[8px] sm:[&_button[role=combobox]>span]:text-[9px]",
              readOnlyClassName,
            )}
          />
        </div>
      </DetailFieldCell>
      <DetailFieldCell label="Horas" className="gap-0">
        <FormNumber
          source="horas"
          label={false}
          inputMode="decimal"
          step={0.25}
          min={VALIDATION_RULES.HORAS.MIN}
          max={VALIDATION_RULES.HORAS.MAX}
          widthClass="w-full"
          validate={required()}
          readOnly={!isActive}
          className={cn(
            "gap-0 [&_input]:h-3.5 [&_input]:px-0.5 [&_input]:text-[8px] sm:[&_input]:h-4 sm:[&_input]:px-1 sm:[&_input]:text-[9px]",
            readOnlyClassName,
          )}
        />
      </DetailFieldCell>
      <DetailFieldCell label="Estado">
        <ReferenceInput
          source="idestado"
          reference="parte-diario-estados"
          filter={{ activo: true }}
        >
          <FormSelectFijo
            optionText="nombre"
            label={false}
            emptyText="Sin estado"
            fixedWidth="122px"
            widthClass="w-[122px]"
            className={readOnlyClassName}
            triggerProps={{
              style: {
                height: "16px",
                minHeight: "16px",
                maxHeight: "16px",
                paddingTop: 0,
                paddingBottom: 0,
              },
              className:
                "px-0.5 text-left text-[8px] whitespace-nowrap sm:px-1 sm:text-[9px] " +
                "[&_svg]:size-2.5 " +
                "*:data-[slot=select-value]:line-clamp-1 " +
                "*:data-[slot=select-value]:truncate " +
                "*:data-[slot=select-value]:whitespace-nowrap " +
                "*:data-[slot=select-value]:leading-none",
            }}
          />
        </ReferenceInput>
      </DetailFieldCell>
      <DetailFieldCell
        label="Descripcion"
        className={cn(!hasDescripcion && "hidden sm:flex")}
      >
        <FormText
          source="descripcion"
          label={false}
          placeholder="Tareas realizadas o nota"
          widthClass="w-full"
          readOnly={!isActive}
          maxLength={VALIDATION_RULES.DETALLE_DESCRIPCION.MAX_LENGTH}
          className={cn(
            "[&_input]:h-3.5 [&_input]:px-0.5 [&_input]:text-[8px] sm:[&_input]:h-4 sm:[&_input]:px-1 sm:[&_input]:text-[9px]",
            readOnlyClassName,
          )}
        />
      </DetailFieldCell>
    </>
  );
};

const ParteDiarioConfirmButton = ({ returnTo }: { returnTo?: string | null }) => {
  const record = useRecordContext<ParteDiarioRecord>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const form = useFormContext<ParteDiarioFormValues>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const canConfirm = Boolean(!record?.id || record.estado === "borrador");

  const handleRequestConfirm = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      notify("Revisa los campos requeridos antes de confirmar.", { type: "warning" });
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const payload = normalizeParteDiarioPayload({
        ...form.getValues(),
        estado: "confirmado",
      });
      const response = record?.id
        ? await dataProvider.update<ParteDiarioRecord>("parte-diario", {
            id: record.id,
            data: payload,
            previousData: record,
          })
        : await dataProvider.create<ParteDiarioRecord>("parte-diario", {
            data: payload,
          });
      form.reset(response.data as Partial<ParteDiarioFormValues>);
      notify("Parte diario confirmado", { type: "success" });
      refresh();
      setConfirmOpen(false);
      if (!record?.id) {
        navigate(returnTo || "/parte-diario", { replace: true });
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo confirmar el parte diario", {
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="default"
        className="h-7 px-2 text-[11px] sm:h-9 sm:px-4 sm:text-sm"
        disabled={!canConfirm || loading}
        onClick={() => void handleRequestConfirm()}
        title={canConfirm ? "Confirmar parte diario" : "Disponible solo para partes en borrador"}
      >
        {loading ? (
          <Loader2 className="size-3 animate-spin sm:size-4" />
        ) : (
          <CheckCircle2 className="size-3 sm:size-4" />
        )}
        Confirmar
      </Button>
      <Confirm
        isOpen={confirmOpen}
        loading={loading}
        title="Confirmar parte diario"
        content="Se guardaran los datos actuales y el parte diario quedara confirmado."
        confirm="Confirmar"
        cancel="Cancelar"
        overlayClassName="bg-transparent backdrop-blur-0"
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
        onConfirm={() => {
          void handleConfirm();
        }}
      />
    </>
  );
};

const useHasParteDiarioNovedades = () => {
  const detalles = useWatch({ name: "detalles" }) as
    | Array<{ idnomina?: unknown }>
    | undefined;

  return (detalles ?? []).some(
    (detalle) => detalle?.idnomina != null && detalle.idnomina !== "",
  );
};

const ParteDiarioSinNovedadButton = () => {
  const record = useRecordContext<ParteDiarioRecord>();
  if (record?.id) return null;

  return (
    <FormOrderSaveButton
      type="button"
      label="Sin novedad"
      variant="outline"
      alwaysEnable
      icon={<CheckCircle className="size-3 sm:size-4" />}
      transform={(data: Partial<ParteDiarioFormValues>) =>
        normalizeParteDiarioPayload({
          ...data,
          estado: "confirmado",
          detalles: [],
        })
      }
    />
  );
};

const ParteDiarioPrimaryAction = ({ returnTo }: { returnTo?: string | null }) => {
  const record = useRecordContext<ParteDiarioRecord>();
  const hasNovedades = useHasParteDiarioNovedades();
  if (record?.id && record.estado !== "borrador") return null;

  return hasNovedades ? (
    <ParteDiarioConfirmButton returnTo={returnTo} />
  ) : (
    <ParteDiarioSinNovedadButton />
  );
};

const ParteDiarioSaveButton = ({ returnTo }: { returnTo?: string | null }) => {
  const record = useRecordContext<ParteDiarioRecord>();
  const saveContext = useSaveContext();
  const form = useFormContext<ParteDiarioFormValues>();
  const { dirtyFields, isSubmitting, isValidating } = useFormState({ control: form.control });
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasGeneratedTarja, setHasGeneratedTarja] = useState(false);
  const [loading, setLoading] = useState(false);
  const isDirty = Object.keys(dirtyFields).length > 0;
  const shouldRegenerate = Boolean(record?.id && hasGeneratedTarja && isDirty);

  useEffect(() => {
    if (!record?.id) {
      setHasGeneratedTarja(false);
      return;
    }

    const controller = new AbortController();
    fetchParteTarjaStatus(record.id, controller.signal)
      .then((status) => setHasGeneratedTarja(status.exists))
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setHasGeneratedTarja(false);
        }
      });

    return () => controller.abort();
  }, [record?.id]);

  const handleSaved = useCallback(
    async (regenerate: boolean) => {
      if (!record?.id && returnTo) {
        navigate(returnTo, { replace: true });
        return;
      }
      if (regenerate && record?.id) {
        await postRegenerarTarjaParte(record.id);
        notify("Parte diario guardado y tarja regenerada", { type: "success" });
      } else {
        notify("Parte diario guardado", { type: "success" });
      }
      refresh();
      if (returnTo) {
        navigate(returnTo, { replace: true });
        return;
      }
      navigate("/parte-diario", { replace: true });
    },
    [navigate, notify, record?.id, refresh, returnTo],
  );

  const save = useCallback(
    async (regenerate: boolean) => {
      setLoading(true);
      try {
        const callbacks: SaveHandlerCallbacks = {
          onSuccess: async () => {
            await handleSaved(regenerate);
          },
        };
        const errors = await saveContext?.save?.(
          form.getValues() as Partial<ParteDiarioRecord>,
          callbacks,
        );
        if (errors != null) {
          setSubmissionErrors(errors, form.setError as UseFormSetError<FieldValues>);
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : "No se pudo guardar el parte diario", {
          type: "error",
        });
      } finally {
        setLoading(false);
        setConfirmOpen(false);
      }
    },
    [form, handleSaved, notify, saveContext],
  );

  const handleClick = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      notify("Revisa los campos requeridos antes de guardar.", { type: "warning" });
      return;
    }
    if (shouldRegenerate) {
      setConfirmOpen(true);
      return;
    }
    await save(false);
  };

  if (!record?.id) {
    return <FormOrderSaveButton variant="secondary" />;
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="h-7 px-2 text-[11px] sm:h-9 sm:px-4 sm:text-sm"
        disabled={!isDirty || isSubmitting || isValidating || loading}
        onClick={() => void handleClick()}
      >
        {loading ? (
          <Loader2 className="size-3 animate-spin sm:size-4" />
        ) : (
          <Save className="size-3 sm:size-4" />
        )}
        Guardar
      </Button>
      <Confirm
        isOpen={confirmOpen}
        loading={loading}
        title="Guardar y regenerar tarja"
        content="El parte diario tiene cambios y ya existe una tarja generada para esta fecha. Se guardaran los cambios y se regenerara la tarja automaticamente."
        confirm="Guardar y regenerar"
        cancel="Cancelar"
        overlayClassName="bg-transparent backdrop-blur-0"
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
        onConfirm={() => {
          void save(true);
        }}
      />
    </>
  );
};

const ParteDiarioToolbar = ({ returnTo }: { returnTo?: string | null }) => (
  <div className="flex w-full items-center justify-end gap-2">
    <FormOrderCancelButton />
    <ParteDiarioPrimaryAction returnTo={returnTo} />
    <ParteDiarioSaveButton returnTo={returnTo} />
  </div>
);

const ParteDiarioResumenTotales = ({
  addDisabled,
  onAdd,
}: {
  addDisabled: boolean;
  onAdd: () => void;
}) => {
  const detalles = useWatch({ name: "detalles" }) as
    | Array<{ idnomina?: unknown; horas?: unknown }>
    | undefined;
  const lineasConEmpleado = (detalles ?? []).filter(
    (detalle) => detalle?.idnomina != null && detalle.idnomina !== "",
  );
  const cantidadEmpleados = lineasConEmpleado.length;
  const totalHoras = lineasConEmpleado.reduce((total, detalle) => {
    const horas = Number(detalle.horas ?? 0);
    return total + (Number.isFinite(horas) ? horas : 0);
  }, 0);
  const cantidadAusencias = lineasConEmpleado.filter((detalle) => {
    const horas = Number(detalle.horas ?? 0);
    return Number.isFinite(horas) && horas === 0;
  }).length;

  return (
    <div className="flex flex-row flex-nowrap items-center justify-between gap-1.5 rounded-md border border-muted/50 bg-muted/15 px-2 py-0.5 text-[8px] text-muted-foreground sm:gap-2 sm:px-2.5 sm:py-1 sm:text-[9px]">
      <button
        type="button"
        className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md border border-blue-300 bg-white px-1.5 text-[8px] font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-[9px]"
        disabled={addDisabled}
        onClick={onAdd}
      >
        <PlusCircle className="size-3" />
        Agregar novedad
      </button>
      <div className="flex flex-row flex-nowrap items-center justify-end gap-1.5 sm:gap-2">
        <span className="flex items-center gap-1 rounded-full border border-muted-foreground/15 bg-background px-1.5 py-0 text-[8px] font-medium text-muted-foreground whitespace-nowrap sm:px-2 sm:text-[9px]">
          Empleados: {cantidadEmpleados}
        </span>
        <span className="flex items-center gap-1 rounded-full border border-muted-foreground/15 bg-background px-1.5 py-0 text-[8px] font-medium text-muted-foreground whitespace-nowrap sm:px-2 sm:text-[9px]">
          Horas: {totalHoras.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
        </span>
        <span className="flex items-center gap-1 rounded-full border border-muted-foreground/15 bg-background px-1.5 py-0 text-[8px] font-medium text-muted-foreground whitespace-nowrap sm:px-2 sm:text-[9px]">
          Ausencias: {cantidadAusencias}
        </span>
      </div>
    </div>
  );
};

export const ParteDiarioForm = ({
  defaultValues = PARTE_DIARIO_DEFAULTS,
  returnTo,
}: {
  defaultValues?: Partial<ParteDiarioFormValues>;
  returnTo?: string | null;
} = {}) => (
  <SimpleForm<ParteDiarioFormValues>
    className="w-full max-w-5xl"
    resolver={zodResolver(parteDiarioSchema) as any}
    toolbar={<ParteDiarioToolbar returnTo={returnTo} />}
    defaultValues={{ ...PARTE_DIARIO_DEFAULTS, ...defaultValues }}
  >
    <FormErrorSummary />
    <ParteDiarioHeaderSection returnTo={returnTo} />
    <ParteDiarioDetalleFields />
  </SimpleForm>
);
