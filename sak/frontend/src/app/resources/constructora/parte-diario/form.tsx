"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ResourceContextProvider,
  required,
  useCreatePath,
  useDataProvider,
  useGetList,
  useGetOne,
  useNotify,
  useRecordContext,
  useRefresh,
  useResourceContext,
  useSaveContext,
  useWrappedSource,
  setSubmissionErrors,
  type SaveHandlerCallbacks,
} from "ra-core";
import { useCallback, useMemo, useState } from "react";
import {
  useFormContext,
  useFormState,
  useWatch,
  type FieldValues,
  type UseFormSetError,
} from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  PlusCircle,
  Save,
  UserMinus,
  UserPlus,
} from "lucide-react";
import {
  NominaQuickCreateDialog,
  type CreatedNomina,
} from "@/app/resources/constructora/tarja-nomina/nomina-quick-create-dialog";
import {
  TARJA_NOMINA_DEFAULT,
  normalizeTarjaNominaPayload,
  type TarjaNomina,
} from "@/app/resources/constructora/tarja-nomina/model";
import { Confirm } from "@/components/confirm";
import { FormOrderCancelButton, FormOrderSaveButton, FormOrderToolbar } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
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
import { dataProvider as directDataProvider, extractErrorMessage } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";
import {
  PARTE_DIARIO_DEFAULTS,
  getParteDiarioJornadaEsperada,
  getParteDiarioDetalleDefaults,
  normalizeParteDiarioPayload,
  parteDiarioSchema,
  VALIDATION_RULES,
  type ParteDiarioRecord,
  type ParteDiarioFormValues,
} from "./model";
import { ParteDiarioAgentChatButton } from "./navigation-title";

const formatAgentChatDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${value.getFullYear()}`;
  }
  const raw = String(value ?? "").trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  return raw;
};

const firstContactPhone = (value: unknown) => {
  const phones = (value as { telefonos?: unknown[] | null } | null | undefined)?.telefonos;
  const first = Array.isArray(phones) ? phones[0] : undefined;
  return typeof first === "string" ? first.trim() : "";
};

type ReferenceRecord = { id: number | string } & Record<string, unknown>;

type ParteDiarioEstadoRecord = {
  id: number | string;
  abreviatura?: string | null;
  nombre?: string | null;
  activo?: boolean | null;
};

type BajaNominaFormValues = {
  idnomina?: number | string | null;
};

type BajaNominaImpacto = {
  id: number | string;
  novedades: number;
  traslados: number;
  tarja_detalles: number;
  proxima_alta?: string | null;
};

type AltaDeletePending = {
  remove: () => void;
};

const getBajaImpactoMessage = (impacto: BajaNominaImpacto) => {
  const efectos: string[] = [];
  if (impacto.novedades > 0) {
    const novedades = `${impacto.novedades} ${
      impacto.novedades === 1 ? "novedad posterior" : "novedades posteriores"
    }`;
    const traslados = impacto.traslados > 0
      ? ` (${impacto.traslados} ${impacto.traslados === 1 ? "traslado" : "traslados"})`
      : "";
    efectos.push(`anulara ${novedades}${traslados}`);
  }
  if (impacto.tarja_detalles > 0) {
    efectos.push(
      `eliminara ${impacto.tarja_detalles} ${
        impacto.tarja_detalles === 1 ? "registro de tarja" : "registros de tarja"
      }`,
    );
  }
  const limite = impacto.proxima_alta
    ? ` No se modificara el reingreso del ${formatAgentChatDate(impacto.proxima_alta)}.`
    : "";
  return `La baja ${efectos.join(" y ")}. Los cambios se aplicaran al confirmar el parte.${limite}`;
};

type TraspasoNominaFormValues = {
  idnomina?: number | string | null;
  proyecto_encargado_id?: number | string | null;
  horas?: number | string | null;
};

type ProyectoEncargadoRecord = {
  id: number | string;
  proyecto_id?: number | null;
  contacto_id?: number | null;
  proyecto?: { nombre?: string | null } | null;
  contacto?: { nombre_completo?: string | null; nombre?: string | null } | null;
};

const formatISODate = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const getParteDateValue = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatISODate(value);
  }
  const raw = String(value ?? "").trim();
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoMatch ? isoMatch[1] : "";
};

const getQuincenaRange = (value: unknown) => {
  const fecha = getParteDateValue(value);
  if (!fecha) return null;
  const [year, month, day] = fecha.split("-").map(Number);
  if (!year || !month || !day) return null;
  const startDate =
    day <= 10
      ? new Date(year, month - 2, 26)
      : day <= 25
        ? new Date(year, month - 1, 11)
        : new Date(year, month - 1, 26);
  const endDate =
    day <= 10
      ? new Date(year, month - 1, 10)
      : day <= 25
        ? new Date(year, month - 1, 25)
        : new Date(year, month, 10);
  return {
    fecha,
    fechainicio: formatISODate(startDate),
    fechafinal: formatISODate(endDate),
  };
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

const getProyectoEncargadoLabel = (choice?: unknown) => {
  if (!choice || typeof choice !== "object") return "";
  const record = choice as ProyectoEncargadoRecord;
  const obra = record.proyecto?.nombre || `Obra #${record.proyecto_id ?? ""}`;
  const encargado =
    record.contacto?.nombre_completo ||
    record.contacto?.nombre ||
    (record.contacto_id ? `Encargado #${record.contacto_id}` : "Sin encargado");
  return `${obra} - ${encargado}`;
};

const sortProyectoEncargadoByLabel = (left: ProyectoEncargadoRecord, right: ProyectoEncargadoRecord) =>
  getProyectoEncargadoLabel(left).localeCompare(getProyectoEncargadoLabel(right), "es", {
    sensitivity: "base",
  });

const getDestinoDescripcion = (value?: string | null) => {
  if (!value?.trim()) return "";
  try {
    const parsed = JSON.parse(
      value.replace(/\s*\[parte_diario_destino_id=\d+\]\s*$/, "").trim(),
    );
    const destino = parsed?.destino;
    if (!destino || typeof destino !== "object") return "";
    const label = typeof destino.label === "string" ? destino.label.trim() : "";
    if (label) return label;
    const obra = typeof destino.obra === "string" ? destino.obra.trim() : "";
    const encargado =
      typeof destino.encargado === "string" ? destino.encargado.trim() : "";
    const destinoLabel = [obra, encargado].filter(Boolean).join(" - ");
    const horasDestino = Number(parsed?.horas);
    const horasLabel = Number.isFinite(horasDestino) ? `, ${horasDestino}h` : "";
    return parsed?.tipo === "trabajo_destino" && destinoLabel
      ? `Trabajó en: ${destinoLabel}${horasLabel}`
      : destinoLabel;
  } catch {
    return "";
  }
};

const isTrabajoDestinoDescripcion = (value: unknown) => {
  if (typeof value !== "string") return false;
  try {
    const parsed = JSON.parse(
      value.replace(/\s*\[parte_diario_destino_id=\d+\]\s*$/, "").trim(),
    );
    return parsed?.tipo === "trabajo_destino";
  } catch {
    return false;
  }
};

const BajaNominaDialog = ({
  open,
  onClose,
  onSubmit,
  proyectoId,
  contactoId,
  proyectoNombre,
  contactoNombre,
  fecha,
  fechaLabel,
  loading,
  excludedNominaIds,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (nominaId: number) => void | Promise<void>;
  proyectoId: number | null;
  contactoId: number | null;
  proyectoNombre?: string;
  contactoNombre?: string;
  fecha?: string;
  fechaLabel?: string;
  loading: boolean;
  excludedNominaIds: Set<number>;
}) => {
  const notify = useNotify();
  const nominaFilter = {
    ...(proyectoId ? { idproyecto: proyectoId } : {}),
    ...(contactoId ? { contacto_id: contactoId } : {}),
    ...(fecha ? { fecha } : {}),
  };

  const handleSubmit = async (values: BajaNominaFormValues) => {
    const nominaId = resolveNumericId(values.idnomina);
    if (!nominaId) {
      notify("Selecciona un empleado para registrar la baja.", { type: "warning" });
      return;
    }
    if (excludedNominaIds.has(nominaId)) {
      notify("El empleado ya tiene una novedad cargada en este parte.", { type: "warning" });
      return;
    }
    await onSubmit(nominaId);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Baja de nomina</DialogTitle>
          <DialogDescription>
            Selecciona el empleado que deja de trabajar desde la fecha del parte.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 rounded-md border border-muted/70 bg-muted/30 p-2 text-[11px] sm:grid-cols-3 sm:text-xs">
          <div className="min-w-0">
            <div className="text-[9px] font-medium uppercase text-muted-foreground sm:text-[10px]">
              Obra
            </div>
            <div className="truncate font-medium">{proyectoNombre || "-"}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-medium uppercase text-muted-foreground sm:text-[10px]">
              Encargado
            </div>
            <div className="truncate font-medium">{contactoNombre || "Sin encargado"}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-medium uppercase text-muted-foreground sm:text-[10px]">
              Fecha
            </div>
            <div className="truncate font-medium">{fechaLabel || "-"}</div>
          </div>
        </div>
        <ResourceContextProvider value="parte-diario">
          <SimpleForm<BajaNominaFormValues>
            className="w-full max-w-none"
            defaultValues={{ idnomina: null }}
            onSubmit={handleSubmit}
            toolbar={
              <FormOrderToolbar
                cancelProps={{ onClick: onClose, disabled: loading }}
                saveProps={{ alwaysEnable: true, disabled: loading }}
              />
            }
          >
            <FormErrorSummary />
            <FormReferenceAutocomplete
              referenceProps={{
                source: "idnomina",
                reference: "parte-diario/nomina-disponible",
                filter: nominaFilter,
                sort: { field: "apellido", order: "ASC" },
              }}
              inputProps={{
                optionText: getNominaLabel,
                inputText: getNominaLabel,
                label: "Empleado",
                validate: required(),
                placeholder: "Seleccionar",
                optionFilter: (choice) => !excludedNominaIds.has(Number(choice.id)),
              }}
              widthClass="w-full"
            />
          </SimpleForm>
        </ResourceContextProvider>
      </DialogContent>
    </Dialog>
  );
};

const DestinoNominaDialog = ({
  tipo,
  open,
  onClose,
  onSubmit,
  proyectoId,
  contactoId,
  proyectoNombre,
  contactoNombre,
  fecha,
  fechaLabel,
  jornadaHoras,
  loading,
  excludedNominaIds,
}: {
  tipo: "traspaso" | "trabajo";
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    nominaId: number;
    proyectoEncargadoId: number;
    horas?: number;
  }) => void | Promise<void>;
  proyectoId: number | null;
  contactoId: number | null;
  proyectoNombre?: string;
  contactoNombre?: string;
  fecha?: string;
  fechaLabel?: string;
  jornadaHoras: number;
  loading: boolean;
  excludedNominaIds: Set<number>;
}) => {
  const notify = useNotify();
  const esTrabajoTemporal = tipo === "trabajo";
  const nominaFilter = {
    ...(proyectoId ? { idproyecto: proyectoId } : {}),
    ...(contactoId ? { contacto_id: contactoId } : {}),
    ...(fecha ? { fecha } : {}),
  };

  const handleSubmit = async (values: TraspasoNominaFormValues) => {
    const nominaId = resolveNumericId(values.idnomina);
    const proyectoEncargadoId = resolveNumericId(values.proyecto_encargado_id);
    if (!nominaId || !proyectoEncargadoId) {
      notify(
        esTrabajoTemporal
          ? "Selecciona empleado y destino para registrar dónde trabajó."
          : "Selecciona empleado y destino para registrar el traspaso.",
        { type: "warning" },
      );
      return;
    }
    const horas = Number(values.horas);
    if (esTrabajoTemporal && (!Number.isFinite(horas) || horas < 0 || horas > 24)) {
      notify("Las horas en la obra destino deben estar entre 0 y 24.", { type: "warning" });
      return;
    }
    if (excludedNominaIds.has(nominaId)) {
      notify("El empleado ya tiene una novedad cargada en este parte.", { type: "warning" });
      return;
    }
    await onSubmit({
      nominaId,
      proyectoEncargadoId,
      ...(esTrabajoTemporal ? { horas } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{esTrabajoTemporal ? "Trabajo en otra obra" : "Traspaso de nomina"}</DialogTitle>
          <DialogDescription>
            {esTrabajoTemporal
              ? "Selecciona el empleado, el destino y las horas trabajadas."
              : "Selecciona el empleado y la obra/encargado destino."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 rounded-md border border-muted/70 bg-muted/30 p-2 text-[11px] sm:grid-cols-3 sm:text-xs">
          <div className="min-w-0">
            <div className="text-[9px] font-medium uppercase text-muted-foreground sm:text-[10px]">
              Obra origen
            </div>
            <div className="truncate font-medium">{proyectoNombre || "-"}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-medium uppercase text-muted-foreground sm:text-[10px]">
              Encargado origen
            </div>
            <div className="truncate font-medium">{contactoNombre || "Sin encargado"}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-medium uppercase text-muted-foreground sm:text-[10px]">
              Fecha
            </div>
            <div className="truncate font-medium">{fechaLabel || "-"}</div>
          </div>
        </div>
        <ResourceContextProvider value="parte-diario">
          <SimpleForm<TraspasoNominaFormValues>
            className="w-full max-w-none"
            defaultValues={{
              idnomina: null,
              proyecto_encargado_id: null,
              ...(esTrabajoTemporal ? { horas: jornadaHoras } : {}),
            }}
            onSubmit={handleSubmit}
            toolbar={
              <FormOrderToolbar
                cancelProps={{ onClick: onClose, disabled: loading }}
                saveProps={{ alwaysEnable: true, disabled: loading }}
              />
            }
          >
            <FormErrorSummary />
            <div
              className={cn(
                "grid gap-2",
                esTrabajoTemporal ? "md:grid-cols-[1fr_1fr_140px]" : "md:grid-cols-2",
              )}
            >
              <FormReferenceAutocomplete
                referenceProps={{
                  source: "idnomina",
                  reference: "parte-diario/nomina-disponible",
                  filter: nominaFilter,
                  sort: { field: "apellido", order: "ASC" },
                }}
                inputProps={{
                  optionText: getNominaLabel,
                  inputText: getNominaLabel,
                  label: "Empleado",
                  validate: required(),
                  placeholder: "Seleccionar",
                  optionFilter: (choice) => !excludedNominaIds.has(Number(choice.id)),
                }}
                widthClass="w-full"
              />
              <FormReferenceAutocomplete
                referenceProps={{
                  source: "proyecto_encargado_id",
                  reference: "proyecto-encargados",
                  filter: { activo: true },
                  sort: { field: "id", order: "ASC" },
                }}
                inputProps={{
                  optionText: getProyectoEncargadoLabel,
                  inputText: getProyectoEncargadoLabel,
                  optionSort: sortProyectoEncargadoByLabel,
                  optionFilter: (choice) =>
                    !esTrabajoTemporal || resolveNumericId(choice.proyecto_id) !== proyectoId,
                  label: "Destino",
                  validate: required(),
                  placeholder: "Obra - encargado",
                }}
                widthClass="w-full"
              />
              {esTrabajoTemporal ? (
                <FormNumber
                  source="horas"
                  label="Horas en obra destino"
                  inputMode="decimal"
                  step={0.25}
                  min={0}
                  max={24}
                  widthClass="w-full"
                  validate={required()}
                />
              ) : null}
            </div>
          </SimpleForm>
        </ResourceContextProvider>
      </DialogContent>
    </Dialog>
  );
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

const ParteDiarioDetalleFields = ({ returnTo }: { returnTo?: string | null }) => {
  const record = useRecordContext<ParteDiarioRecord>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const form = useFormContext<ParteDiarioFormValues>();
  const { dirtyFields } = useFormState({ control: form.control });
  const [addRequestSignal, setAddRequestSignal] = useState(0);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [bajaOpen, setBajaOpen] = useState(false);
  const [bajaLoading, setBajaLoading] = useState(false);
  const [bajaPendiente, setBajaPendiente] = useState<{
    nominaId: number;
    impacto: BajaNominaImpacto;
  } | null>(null);
  const [altaDeletePending, setAltaDeletePending] = useState<AltaDeletePending | null>(null);
  const [traspasoDeletePending, setTraspasoDeletePending] =
    useState<AltaDeletePending | null>(null);
  const [traspasoOpen, setTraspasoOpen] = useState(false);
  const [traspasoLoading, setTraspasoLoading] = useState(false);
  const [trabajoDestinoOpen, setTrabajoDestinoOpen] = useState(false);
  const [trabajoDestinoLoading, setTrabajoDestinoLoading] = useState(false);
  const idproyectoValue = useWatch({ name: "idproyecto" });
  const contactoValue = useWatch({ name: "contacto_id" });
  const fechaValue = useWatch({ name: "fecha" });
  const detallesValue = useWatch({ name: "detalles" });
  const proyectoId = resolveNumericId(idproyectoValue);
  const contactoId = resolveNumericId(contactoValue);
  const detalleNominaIds = useMemo(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    return new Set(
      detalles
        .map((detalle) =>
          resolveNumericId((detalle as { idnomina?: unknown } | null | undefined)?.idnomina),
        )
        .filter((id): id is number => id != null),
    );
  }, [detallesValue]);
  const { data: proyecto } = useGetOne<ReferenceRecord>(
    "proyectos",
    { id: proyectoId || undefined },
    { enabled: Boolean(proyectoId) },
  );
  const { data: contacto, isLoading: isContactLoading } = useGetOne<ReferenceRecord>(
    "crm/contactos",
    { id: contactoId || undefined },
    { enabled: Boolean(contactoId) },
  );
  const {
    data: estadosParte = [],
    isPending: estadosNoEditablesPending,
  } = useGetList<ParteDiarioEstadoRecord>("parte-diario-estados", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
    filter: {},
  });
  const estadoNoEditableIds = useMemo(
    () =>
      new Set(
        estadosParte
          .filter((estado) => estado.activo === false)
          .map((estado) => resolveNumericId(estado.id))
          .filter((id): id is number => id != null),
      ),
    [estadosParte],
  );
  const altaEstadoIds = useMemo(
    () =>
      new Set(
        estadosParte
          .filter((estado) => String(estado.abreviatura ?? "").trim().toUpperCase() === "ALT")
          .map((estado) => resolveNumericId(estado.id))
          .filter((id): id is number => id != null),
      ),
    [estadosParte],
  );
  const traspasoEstadoIds = useMemo(
    () =>
      new Set(
        estadosParte
          .filter((estado) => String(estado.abreviatura ?? "").trim().toUpperCase() === "TRA")
          .map((estado) => resolveNumericId(estado.id))
          .filter((id): id is number => id != null),
      ),
    [estadosParte],
  );
  const canEditDetalleRow = useCallback(
    (rowValue: Record<string, unknown>) => {
      if (isTrabajoDestinoDescripcion(rowValue.descripcion)) return false;
      const estadoId = resolveNumericId(rowValue.idestado);
      if (estadoId == null) return true;
      if (estadosNoEditablesPending && estadoNoEditableIds.size === 0) {
        return false;
      }
      return !estadoNoEditableIds.has(estadoId);
    },
    [estadoNoEditableIds, estadosNoEditablesPending],
  );
  const handleRequestDeleteDetalle = useCallback(
    (rowValue: Record<string, unknown>, _index: number, remove: () => void) => {
      const estadoId = resolveNumericId(rowValue.idestado);
      if (estadoId != null && altaEstadoIds.has(estadoId)) {
        setAltaDeletePending({ remove });
        return;
      }
      if (estadoId != null && traspasoEstadoIds.has(estadoId)) {
        setTraspasoDeletePending({ remove });
        return;
      }
      remove();
    },
    [altaEstadoIds, traspasoEstadoIds],
  );
  const agentInitialMessage = useMemo(() => {
    const nombreObra = typeof proyecto?.nombre === "string" ? proyecto.nombre.trim() : "";
    const fecha = formatAgentChatDate(fechaValue);
    if (!nombreObra || !fecha) return undefined;
    return `parte diario ${nombreObra} ${fecha}`;
  }, [fechaValue, proyecto?.nombre]);
  const agentContactName =
    typeof contacto?.nombre_completo === "string" ? contacto.nombre_completo.trim() : undefined;
  const agentContactPhone = firstContactPhone(contacto);
  const isAgentPhoneLoading = Boolean(contactoId && isContactLoading);
  const isDirty = Object.keys(dirtyFields).length > 0;
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
  const handleOpenAltaNomina = async () => {
    const isValid = await form.trigger(["idproyecto", "fecha"]);
    if (!isValid || !proyectoId || !getQuincenaRange(fechaValue)) {
      notify("Selecciona proyecto y fecha antes de registrar el alta.", { type: "warning" });
      return;
    }
    setQuickCreateOpen(true);
  };
  const handleOpenBajaNomina = async () => {
    const isValid = await form.trigger(["idproyecto", "fecha"]);
    if (!isValid || !proyectoId || !getQuincenaRange(fechaValue)) {
      notify("Selecciona proyecto y fecha antes de registrar la baja.", { type: "warning" });
      return;
    }
    setBajaOpen(true);
  };
  const handleOpenTraspasoNomina = async () => {
    const isValid = await form.trigger(["idproyecto", "contacto_id", "fecha"]);
    if (!isValid || !proyectoId || !contactoId || !getQuincenaRange(fechaValue)) {
      notify("Selecciona proyecto, encargado y fecha antes de registrar el traspaso.", {
        type: "warning",
      });
      return;
    }
    setTraspasoOpen(true);
  };
  const handleOpenTrabajoDestino = async () => {
    const isValid = await form.trigger(["idproyecto", "contacto_id", "fecha"]);
    if (!isValid || !proyectoId || !contactoId || !getQuincenaRange(fechaValue)) {
      notify("Selecciona proyecto, encargado y fecha antes de registrar dónde trabajó.", {
        type: "warning",
      });
      return;
    }
    setTrabajoDestinoOpen(true);
  };
  const addBajaNomina = async (nominaId: number) => {
    const { data: bajaEstados } = await dataProvider.getList<{ id: number | string }>(
      "parte-diario-estados",
      {
        filter: { abreviatura: "BAJ" },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      },
    );
    const bajaEstadoId = bajaEstados[0]?.id;
    if (!bajaEstadoId) {
      notify("No se encontro el estado BAJ para registrar la baja.", { type: "error" });
      return;
    }

    const detalles = form.getValues("detalles") ?? [];
    if (detalles.some((detalle) => resolveNumericId(detalle.idnomina) === nominaId)) {
      notify("El empleado ya tiene una novedad cargada en este parte.", { type: "warning" });
      return;
    }
    form.setValue(
      "detalles",
      [
        ...detalles,
        {
          idnomina: nominaId,
          horas: 0,
          idestado: Number(bajaEstadoId),
          ingreso: "",
          egreso: "",
          descripcion: "",
        },
      ],
      { shouldDirty: true, shouldValidate: true },
    );
    setBajaOpen(false);
    notify("Baja de nomina agregada como novedad", { type: "success" });
  };

  const handleBajaNominaSelected = async (nominaId: number) => {
    setBajaLoading(true);
    try {
      if (record?.id) {
        const { data: impacto } = await dataProvider.getOne<BajaNominaImpacto>(
          `parte-diario/${record.id}/baja-impacto`,
          { id: nominaId },
        );
        if (impacto.novedades > 0 || impacto.tarja_detalles > 0) {
          setBajaPendiente({ nominaId, impacto });
          return;
        }
      }
      await addBajaNomina(nominaId);
    } catch (error) {
      notify(extractErrorMessage(error, "No se pudo analizar el impacto de la baja"), {
        type: "error",
      });
    } finally {
      setBajaLoading(false);
    }
  };

  const handleConfirmBajaNomina = async () => {
    if (!bajaPendiente) return;
    const { nominaId } = bajaPendiente;
    setBajaLoading(true);
    try {
      await addBajaNomina(nominaId);
      setBajaPendiente(null);
    } catch (error) {
      notify(extractErrorMessage(error, "No se pudo agregar la baja de nomina"), {
        type: "error",
      });
    } finally {
      setBajaLoading(false);
    }
  };
  const handleTraspasoNominaSelected = async ({
    nominaId,
    proyectoEncargadoId,
  }: {
    nominaId: number;
    proyectoEncargadoId: number;
  }) => {
    if (!proyectoId || !contactoId) return;
    setTraspasoLoading(true);
    try {
      const [{ data: traspasoEstados }, { data: destino }] = await Promise.all([
        dataProvider.getList<{ id: number | string }>("parte-diario-estados", {
          filter: { abreviatura: "TRA" },
          pagination: { page: 1, perPage: 1 },
          sort: { field: "id", order: "ASC" },
        }),
        dataProvider.getOne<ProyectoEncargadoRecord>("proyecto-encargados", {
          id: proyectoEncargadoId,
        }),
      ]);
      const traspasoEstadoId = traspasoEstados[0]?.id;
      if (!traspasoEstadoId) {
        notify("No se encontro el estado TRA para registrar el traspaso.", { type: "error" });
        return;
      }
      const destinoProyectoId = resolveNumericId(destino.proyecto_id);
      const destinoContactoId = resolveNumericId(destino.contacto_id);
      if (!destinoProyectoId || !destinoContactoId) {
        notify("No se pudo resolver la obra y encargado destino.", { type: "error" });
        return;
      }
      if (destinoProyectoId === proyectoId && destinoContactoId === contactoId) {
        notify("La obra y encargado destino deben ser diferentes al origen.", { type: "warning" });
        return;
      }

      const destinoNombre = getProyectoEncargadoLabel(destino);
      const payload = {
        tipo: "traspaso",
        origen: {
          idproyecto: proyectoId,
          contacto_id: contactoId,
          obra: typeof proyecto?.nombre === "string" ? proyecto.nombre : null,
          encargado:
            typeof contacto?.nombre_completo === "string" ? contacto.nombre_completo : null,
        },
        destino: {
          idproyecto: destinoProyectoId,
          contacto_id: destinoContactoId,
          obra: destino.proyecto?.nombre ?? null,
          encargado:
            destino.contacto?.nombre_completo ?? destino.contacto?.nombre ?? null,
          label: destinoNombre,
        },
      };

      const detalles = form.getValues("detalles") ?? [];
      if (detalles.some((detalle) => resolveNumericId(detalle.idnomina) === nominaId)) {
        notify("El empleado ya tiene una novedad cargada en este parte.", { type: "warning" });
        return;
      }
      form.setValue(
        "detalles",
        [
          ...detalles,
          {
            idnomina: nominaId,
            horas: 0,
            idestado: Number(traspasoEstadoId),
            ingreso: "",
            egreso: "",
            descripcion: JSON.stringify(payload),
          },
        ],
        { shouldDirty: true, shouldValidate: true },
      );
      setTraspasoOpen(false);
      notify("Traspaso de nomina agregado como novedad", { type: "success" });
    } finally {
      setTraspasoLoading(false);
    }
  };
  const handleTrabajoDestinoSelected = async ({
    nominaId,
    proyectoEncargadoId,
    horas,
  }: {
    nominaId: number;
    proyectoEncargadoId: number;
    horas?: number;
  }) => {
    if (!proyectoId || !contactoId) return;
    setTrabajoDestinoLoading(true);
    try {
      const [{ data: presenteEstados }, { data: destino }] = await Promise.all([
        dataProvider.getList<{ id: number | string }>("parte-diario-estados", {
          filter: { abreviatura: "P" },
          pagination: { page: 1, perPage: 1 },
          sort: { field: "id", order: "ASC" },
        }),
        dataProvider.getOne<ProyectoEncargadoRecord>("proyecto-encargados", {
          id: proyectoEncargadoId,
        }),
      ]);
      const presenteEstadoId = presenteEstados[0]?.id;
      if (!presenteEstadoId) {
        notify("No se encontro el estado P para registrar el trabajo temporal.", {
          type: "error",
        });
        return;
      }
      const destinoProyectoId = resolveNumericId(destino.proyecto_id);
      const destinoContactoId = resolveNumericId(destino.contacto_id);
      if (!destinoProyectoId || !destinoContactoId) {
        notify("No se pudo resolver la obra y encargado destino.", { type: "error" });
        return;
      }
      if (destinoProyectoId === proyectoId) {
        notify("La obra destino debe ser diferente a la obra de origen.", { type: "warning" });
        return;
      }
      const range = getQuincenaRange(fechaValue);
      if (!range) {
        notify("No se pudo resolver la quincena del parte diario.", { type: "error" });
        return;
      }
      const { data: tarjasDestino } = await dataProvider.getList<{
        id: number | string;
        estado?: string | null;
      }>("tarjas", {
        filter: {
          idproyecto: destinoProyectoId,
          contacto_id: destinoContactoId,
          fechainicio: range.fechainicio,
          fechafinal: range.fechafinal,
        },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      });
      if (
        tarjasDestino.some((tarja) =>
          ["cerrado", "confirmado"].includes(String(tarja.estado ?? "").toLowerCase()),
        )
      ) {
        notify("La tarja de la obra destino ya esta cerrada.", { type: "warning" });
        return;
      }

      const detalles = form.getValues("detalles") ?? [];
      if (detalles.some((detalle) => resolveNumericId(detalle.idnomina) === nominaId)) {
        notify("El empleado ya tiene una novedad cargada en este parte.", { type: "warning" });
        return;
      }
      const horasDestino = Number(horas);
      if (!Number.isFinite(horasDestino) || horasDestino < 0 || horasDestino > 24) {
        notify("Las horas en la obra destino deben estar entre 0 y 24.", { type: "warning" });
        return;
      }
      const horasOrigen = Math.max(
        getParteDiarioJornadaEsperada(fechaValue) - horasDestino,
        0,
      );
      const payload = {
        tipo: "trabajo_destino",
        horas: horasDestino,
        destino: {
          idproyecto: destinoProyectoId,
          contacto_id: destinoContactoId,
          obra: destino.proyecto?.nombre ?? null,
          encargado:
            destino.contacto?.nombre_completo ?? destino.contacto?.nombre ?? null,
        },
      };
      form.setValue(
        "detalles",
        [
          ...detalles,
          {
            idnomina: nominaId,
            horas: horasOrigen,
            idestado: Number(presenteEstadoId),
            ingreso: "",
            egreso: "",
            descripcion: JSON.stringify(payload),
          },
        ],
        { shouldDirty: true, shouldValidate: true },
      );
      setTrabajoDestinoOpen(false);
      notify("Trabajo en otra obra agregado como novedad", { type: "success" });
    } finally {
      setTrabajoDestinoLoading(false);
    }
  };
  const handleNominaCreated = async (nomina: CreatedNomina) => {
    const range = getQuincenaRange(fechaValue);
    const nominaId = Number(nomina.id);
    if (!proyectoId || !range || !Number.isFinite(nominaId) || nominaId <= 0) {
      throw new Error("Faltan datos para registrar el alta en la nomina");
    }

    setQuickCreateLoading(true);
    try {
      const { data: altaEstados } = await dataProvider.getList<{ id: number | string }>(
        "parte-diario-estados",
        {
          filter: { abreviatura: "ALT" },
          pagination: { page: 1, perPage: 1 },
          sort: { field: "id", order: "ASC" },
        },
      );
      const altaEstadoId = altaEstados[0]?.id;
      if (!altaEstadoId) {
        throw new Error("No se encontro el estado ALT para registrar el alta");
      }

      const { data: tarja } = await dataProvider.create<{ id: number; tarja_id?: number }>(
        "tarjas/asegurar-nomina",
        {
          data: {
            idproyecto: proyectoId,
            contacto_id: contactoId || null,
            fechainicio: range.fechainicio,
            fechafinal: range.fechafinal,
          },
        },
      );
      const tarjaId = Number(tarja.tarja_id ?? tarja.id);
      if (!Number.isFinite(tarjaId) || tarjaId <= 0) {
        throw new Error("No se pudo resolver la tarja de nomina");
      }

      const { data: tarjaNomina } = await dataProvider.create<TarjaNomina>("tarja-nomina", {
        data: normalizeTarjaNominaPayload({
          ...TARJA_NOMINA_DEFAULT,
          tarja_id: tarjaId,
          nomina_id: nominaId,
          nomina_categoria_id: nomina.nomina_categoria_id ?? undefined,
          nomina_tarea_id: nomina.nomina_tarea_id ?? undefined,
          fecha_desde: range.fecha,
          fecha_hasta: range.fechafinal,
          tarja_fecha_desde: range.fechainicio,
          tarja_fecha_hasta: range.fechafinal,
        }) as Record<string, unknown>,
      });

      const detalles = form.getValues("detalles") ?? [];
      form.setValue(
        "detalles",
        [
          ...detalles,
          {
            idnomina: nominaId,
            horas: getParteDiarioJornadaEsperada(fechaValue),
            idestado: Number(altaEstadoId),
            ingreso: "",
            egreso: "",
            descripcion: String(tarjaNomina.id),
          },
        ],
        { shouldDirty: true, shouldValidate: true },
      );
      setQuickCreateOpen(false);
      notify("Alta de nomina agregada como novedad", { type: "success" });
    } finally {
      setQuickCreateLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-0">
      <SectionDetailTemplate2
        title="Novedades"
        mainColumns={columns}
        mainFields={DetalleCamposPrincipales}
        defaults={getParteDiarioDetalleDefaults}
        maxHeightClassName="md:h-36 md:min-h-36 md:max-h-36"
        saveOnlyWhenActive
        showDeleteWhenInactive
        showExpandActionOnMobile
        showExpandAction={false}
        showInfoAction={false}
        canEditRow={canEditDetalleRow}
        onRequestDeleteRow={handleRequestDeleteDetalle}
        addButtonLabel="Agregar novedad"
        hideClearAction
        inlineActions={
          <ParteDiarioAgentChatButton
            disabled={isAgentPhoneLoading || !agentContactPhone || isDirty}
            disabledReason={
              isDirty
                ? "Guarda los cambios del parte diario antes de usar IA."
                : "El contacto no tiene telefono para simular WhatsApp."
            }
            initialMessage={agentInitialMessage}
            loading={isAgentPhoneLoading}
            fromName={agentContactName}
            fromPhone={agentContactPhone}
            returnTo={returnTo}
            parteDiarioId={record?.id}
          />
        }
        actions={
          <>
            <DropdownMenuItem
              className="gap-2 text-[9px] sm:text-[10px]"
              disabled={
                activeRowIndex != null ||
                quickCreateLoading ||
                bajaLoading ||
                traspasoLoading ||
                trabajoDestinoLoading
              }
              onClick={() => void handleOpenAltaNomina()}
            >
              {quickCreateLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <UserPlus className="h-3 w-3" />
              )}
              Alta de nomina
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-[9px] sm:text-[10px]"
              disabled={
                activeRowIndex != null ||
                quickCreateLoading ||
                bajaLoading ||
                traspasoLoading ||
                trabajoDestinoLoading
              }
              onClick={() => void handleOpenBajaNomina()}
            >
              <UserMinus className="h-3 w-3" />
              Baja de nomina
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-[9px] sm:text-[10px]"
              disabled={
                activeRowIndex != null ||
                quickCreateLoading ||
                bajaLoading ||
                traspasoLoading ||
                trabajoDestinoLoading
              }
              onClick={() => void handleOpenTraspasoNomina()}
            >
              <ArrowRightLeft className="h-3 w-3" />
              Traspaso de nomina
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-[9px] sm:text-[10px]"
              disabled={
                activeRowIndex != null ||
                quickCreateLoading ||
                bajaLoading ||
                traspasoLoading ||
                trabajoDestinoLoading
              }
              onClick={() => void handleOpenTrabajoDestino()}
            >
              <MapPin className="h-3 w-3" />
              Trabajó en
            </DropdownMenuItem>
          </>
        }
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
        addDisabled={
          activeRowIndex != null ||
          quickCreateLoading ||
          bajaLoading ||
          traspasoLoading ||
          trabajoDestinoLoading
        }
        onAdd={() => setAddRequestSignal((current) => current + 1)}
      />
      <NominaQuickCreateDialog
        open={quickCreateOpen}
        onClose={() => {
          if (!quickCreateLoading) setQuickCreateOpen(false);
        }}
        onCreated={handleNominaCreated}
      />
      <BajaNominaDialog
        open={bajaOpen}
        onClose={() => {
          if (!bajaLoading) setBajaOpen(false);
        }}
        onSubmit={handleBajaNominaSelected}
        proyectoId={proyectoId ?? null}
        contactoId={contactoId ?? null}
        proyectoNombre={typeof proyecto?.nombre === "string" ? proyecto.nombre : undefined}
        contactoNombre={
          typeof contacto?.nombre_completo === "string" ? contacto.nombre_completo : undefined
        }
        fecha={getParteDateValue(fechaValue)}
        fechaLabel={formatAgentChatDate(fechaValue)}
        loading={bajaLoading}
        excludedNominaIds={detalleNominaIds}
      />
      <Confirm
        isOpen={altaDeletePending != null}
        title="Eliminar alta de nomina"
        content="Al guardar el parte se eliminara el alta, todas las novedades posteriores del empleado y sus registros de tarja en cualquier obra desde la fecha del alta. Esta operacion no se puede deshacer."
        confirm="Eliminar alta"
        confirmColor="warning"
        cancel="Volver"
        onClose={() => setAltaDeletePending(null)}
        onConfirm={() => {
          altaDeletePending?.remove();
          setAltaDeletePending(null);
        }}
      />
      <Confirm
        isOpen={traspasoDeletePending != null}
        title="Eliminar traspaso de nomina"
        content="Al guardar el parte se eliminaran las novedades y registros de tarja posteriores en el destino. El empleado volvera a la obra de origen desde la fecha del traspaso y se regeneraran sus horas. Esta operacion no se puede deshacer."
        confirm="Eliminar traspaso"
        confirmColor="warning"
        cancel="Volver"
        onClose={() => setTraspasoDeletePending(null)}
        onConfirm={() => {
          traspasoDeletePending?.remove();
          setTraspasoDeletePending(null);
        }}
      />
      <Confirm
        isOpen={bajaPendiente != null}
        loading={bajaLoading}
        title="Confirmar baja retroactiva"
        content={
          bajaPendiente
            ? getBajaImpactoMessage(bajaPendiente.impacto)
            : ""
        }
        confirm="Agregar baja"
        confirmColor="warning"
        cancel="Volver"
        onClose={() => {
          if (!bajaLoading) setBajaPendiente(null);
        }}
        onConfirm={() => {
          void handleConfirmBajaNomina();
        }}
      />
      <DestinoNominaDialog
        tipo="traspaso"
        open={traspasoOpen}
        onClose={() => {
          if (!traspasoLoading) setTraspasoOpen(false);
        }}
        onSubmit={handleTraspasoNominaSelected}
        proyectoId={proyectoId ?? null}
        contactoId={contactoId ?? null}
        proyectoNombre={typeof proyecto?.nombre === "string" ? proyecto.nombre : undefined}
        contactoNombre={
          typeof contacto?.nombre_completo === "string" ? contacto.nombre_completo : undefined
        }
        fecha={getParteDateValue(fechaValue)}
        fechaLabel={formatAgentChatDate(fechaValue)}
        jornadaHoras={getParteDiarioJornadaEsperada(fechaValue)}
        loading={traspasoLoading}
        excludedNominaIds={detalleNominaIds}
      />
      <DestinoNominaDialog
        tipo="trabajo"
        open={trabajoDestinoOpen}
        onClose={() => {
          if (!trabajoDestinoLoading) setTrabajoDestinoOpen(false);
        }}
        onSubmit={handleTrabajoDestinoSelected}
        proyectoId={proyectoId ?? null}
        contactoId={contactoId ?? null}
        proyectoNombre={typeof proyecto?.nombre === "string" ? proyecto.nombre : undefined}
        contactoNombre={
          typeof contacto?.nombre_completo === "string" ? contacto.nombre_completo : undefined
        }
        fecha={getParteDateValue(fechaValue)}
        fechaLabel={formatAgentChatDate(fechaValue)}
        jornadaHoras={getParteDiarioJornadaEsperada(fechaValue)}
        loading={trabajoDestinoLoading}
        excludedNominaIds={detalleNominaIds}
      />
    </div>
  );
};

const ParteDiarioDetalleMainFields = ({ isActive }: SectionDetailFieldsProps) => {
  const descripcionSource = useWrappedSource("descripcion");
  const descripcion = useWatch({ name: descripcionSource }) as string | undefined;
  const destinoDescripcionLabel = getDestinoDescripcion(descripcion);
  const descripcionVisible = destinoDescripcionLabel || descripcion;
  const proyectoValue = useWatch({ name: "idproyecto" });
  const contactoValue = useWatch({ name: "contacto_id" });
  const fechaValue = useWatch({ name: "fecha" });
  const proyectoId = resolveNumericId(proyectoValue);
  const contactoId = resolveNumericId(contactoValue);
  const hasDescripcion = Boolean(descripcionVisible?.trim());
  const readOnlyClassName = !isActive ? FORM_FIELD_READONLY_CLASS : undefined;
  const nominaFilter = {
    ...(proyectoId ? { idproyecto: proyectoId } : {}),
    ...(contactoId ? { contacto_id: contactoId } : {}),
    ...(getParteDateValue(fechaValue) ? { fecha: getParteDateValue(fechaValue) } : {}),
  };

  return (
    <>
      <DetailFieldCell label="Empleado" data-focus-field="true">
        <div className="flex w-[180px] items-center">
          <FormReferenceAutocomplete
            referenceProps={{
              source: "idnomina",
              reference: "parte-diario/nomina-disponible",
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
        {destinoDescripcionLabel ? (
          <div
            className={cn(
              "h-3.5 w-full truncate px-0.5 text-[8px] leading-3.5 text-muted-foreground sm:h-4 sm:px-1 sm:text-[9px] sm:leading-4",
              readOnlyClassName,
            )}
            title={destinoDescripcionLabel}
          >
            {destinoDescripcionLabel}
          </div>
        ) : (
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
        )}
      </DetailFieldCell>
    </>
  );
};

const ParteDiarioConfirmButton = ({ returnTo }: { returnTo?: string | null }) => {
  const record = useRecordContext<ParteDiarioRecord>();
  // Esta operacion maneja localmente los errores de negocio. Usar el proveedor
  // directo evita que el proxy de React Admin los registre con console.error y
  // que Next.js muestre su overlay de desarrollo para un 400 esperado.
  const dataProvider = directDataProvider;
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const form = useFormContext<ParteDiarioFormValues>();
  const detalles = useWatch({ control: form.control, name: "detalles" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const sinNovedades = !Array.isArray(detalles) || detalles.length === 0;

  const handleRequestConfirm = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      notify("Revisa los campos requeridos antes de confirmar.", { type: "warning" });
      return;
    }
    if (!record?.id) {
      const values = form.getValues();
      try {
        const { data: existentes } = await dataProvider.getList<ParteDiarioRecord>(
          "parte-diario",
          {
            filter: {
              idproyecto: values.idproyecto,
              contacto_id: values.contacto_id ?? null,
              fecha: values.fecha,
            },
            pagination: { page: 1, perPage: 1 },
            sort: { field: "id", order: "DESC" },
          },
        );
        const existente = existentes[0];
        if (existente) {
          notify(
            `Ya existe el parte diario #${existente.id} para la obra, el encargado y la fecha seleccionados. Abrilo desde el listado para editarlo.`,
            { type: "warning" },
          );
          return;
        }
      } catch {
        return;
      }
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
            meta: { suppressErrorNotification: true },
          })
        : await dataProvider.create<ParteDiarioRecord>("parte-diario", {
            data: payload,
            meta: { suppressErrorNotification: true },
          });
      form.reset(response.data as Partial<ParteDiarioFormValues>);
      notify("Parte diario confirmado", { type: "success" });
      refresh();
      setConfirmOpen(false);
      navigate(returnTo || "/parte-diario", { replace: true });
    } catch (error) {
      notify(extractErrorMessage(error, "No se pudo confirmar el parte diario"), { type: "error" });
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
        disabled={loading}
        onClick={() => void handleRequestConfirm()}
        title="Confirmar parte diario"
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
        content={
          sinNovedades
            ? "El parte diario se registrara SIN NOVEDADES y quedara confirmado."
            : "Se guardaran los datos actuales y el parte diario quedara confirmado."
        }
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

const ParteDiarioSaveButton = ({ returnTo }: { returnTo?: string | null }) => {
  const record = useRecordContext<ParteDiarioRecord>();
  const saveContext = useSaveContext();
  const form = useFormContext<ParteDiarioFormValues>();
  const { dirtyFields, isSubmitting, isValidating } = useFormState({ control: form.control });
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const isDirty = Object.keys(dirtyFields).length > 0;

  const handleSaved = useCallback(
    async () => {
      if (!record?.id && returnTo) {
        navigate(returnTo, { replace: true });
        return;
      }
      notify("Parte diario guardado", { type: "success" });
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
    async () => {
      setLoading(true);
      try {
        const callbacks: SaveHandlerCallbacks = {
          onSuccess: async () => {
            await handleSaved();
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
    await save();
  };

  if (!record?.id) {
    return <FormOrderSaveButton variant="secondary" />;
  }

  if (record.estado !== "borrador") {
    return null;
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
    </>
  );
};

const ParteDiarioToolbar = ({ returnTo }: { returnTo?: string | null }) => {
  const form = useFormContext<ParteDiarioFormValues>();
  const { isDirty } = useFormState({ control: form.control });
  const navigate = useNavigate();
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const leaveForm = () => {
    navigate(returnTo || "/parte-diario", { replace: true });
  };

  const handleCancel = () => {
    if (isDirty) {
      setConfirmCancelOpen(true);
      return;
    }
    leaveForm();
  };

  return (
    <>
      <div className="flex w-full items-center justify-end gap-2">
        <FormOrderCancelButton onClick={handleCancel} />
        <ParteDiarioSaveButton returnTo={returnTo} />
        <ParteDiarioConfirmButton returnTo={returnTo} />
      </div>
      <Confirm
        isOpen={confirmCancelOpen}
        title="Descartar cambios"
        content="Hay cambios sin guardar. Si cancelas, se perderan todos los cambios realizados en el parte diario."
        confirm="Descartar cambios"
        confirmColor="warning"
        cancel="Seguir editando"
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={leaveForm}
      />
    </>
  );
};

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
    <ParteDiarioDetalleFields returnTo={returnTo} />
  </SimpleForm>
);
