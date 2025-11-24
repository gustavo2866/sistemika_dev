"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { useNotify, useRefresh, useGetIdentity, useDataProvider } from "ra-core";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ComboboxQuery, FormWizard } from "@/components/forms";
import { cn } from "@/lib/utils";
import type { CRMMensaje } from "./model";

type FormValues = {
  contacto_nuevo: boolean;
  contacto_id?: string;
  contacto_nombre?: string;
  contacto_referencia?: string;
  contacto_responsable_id?: string;
  oportunidad_id?: string;
  crear_oportunidad?: boolean;
  tipo_operacion_id?: string;
  propiedad_id?: string;
  responsable_oportunidad_id?: string;
  evento_tipo_id?: string;
  evento_motivo_id?: string;
  evento_asignado_id?: string;
  evento_descripcion?: string;
  proximo_estado?: string;
  fecha_proximo_estado?: string;
};

type SectionCardProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  active?: boolean;
};

type OportunidadAuto = {
  id: number;
  label: string;
  propiedad_id?: number | null;
  tipo_operacion_id?: number | null;
  responsable_id?: number | null;
  tipo_operacion_nombre?: string | null;
  responsable_nombre?: string | null;
  estado?: string | null;
};

const SectionCard = ({ title, action, children, collapsible, defaultCollapsed, active }: SectionCardProps) => {
  const [collapsed, setCollapsed] = useState(Boolean(defaultCollapsed));

  useEffect(() => {
    setCollapsed(Boolean(defaultCollapsed));
  }, [defaultCollapsed]);

  const header = collapsible ? (
    <button
      type="button"
      onClick={() => setCollapsed((prev) => !prev)}
      className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
    >
      <ChevronDown
        className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
        aria-hidden="true"
      />
      {title}
    </button>
  ) : (
    <h5 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
  );

  return (
    <div
      className={cn(
        "w-full rounded-md border bg-white p-4 shadow-sm space-y-3 transition-colors",
        active ? "border-primary shadow-md" : "border-border"
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {header}
        {action ? <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">{action}</div> : null}
      </div>
      {!collapsed ? children : null}
    </div>
  );
};

const SummaryList = ({ items }: { items: { label: string; value: ReactNode }[] }) => (
  <dl className="text-sm space-y-1">
    {items.map(({ label, value }) => (
      <div key={label} className="flex flex-wrap gap-2">
        <dt className="font-medium text-muted-foreground">{label}:</dt>
        <dd className="text-foreground">{value || "-"}</dd>
      </div>
    ))}
  </dl>
);

const MessagePreview = ({
  referencia,
  asunto,
  contenido,
  contactName,
  resumenOportunidad,
  responsableTexto,
}: {
  referencia?: string;
  asunto?: string;
  contenido?: string | null;
  contactName?: string;
  resumenOportunidad?: string;
  responsableTexto?: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const texto = contenido || "Sin contenido";
  const needsExpand = texto.length > 240;

  return (
    <div className="w-full rounded-md border bg-white p-4 shadow-sm space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          <span className="font-semibold">Referencia:</span> {referencia || "-"}
        </span>
        {contactName ? <span className="font-semibold">{contactName}</span> : null}
      </div>
      <div>
        <span className="font-semibold">Asunto:</span> {asunto || "(sin asunto)"}
      </div>
      {resumenOportunidad ? (
        <div>
          <span className="font-semibold">Oportunidad:</span> {resumenOportunidad}
        </div>
      ) : null}
      {responsableTexto ? (
        <div>
          <span className="font-semibold">Responsable:</span> {responsableTexto}
        </div>
      ) : null}
      <div className="border-t pt-2">
        <div className="font-semibold mb-1">Mensaje</div>
        <div
          className="whitespace-pre-wrap overflow-hidden"
          style={
            needsExpand && !expanded
              ? {
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                }
              : undefined
          }
        >
          {texto}
        </div>
        {needsExpand ? (
          <button
            type="button"
            className="text-xs font-semibold text-primary underline"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Ver menos" : "... ver más"}
          </button>
        ) : null}
      </div>
    </div>
  );
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ESTADO_OPORTUNIDAD_CHOICES = [
  { id: "", name: "Selecciona estado" },
  { id: "1-abierta", name: "Abierta" },
  { id: "2-visita", name: "Visita" },
  { id: "3-cotiza", name: "Cotiza" },
  { id: "4-reserva", name: "Reserva" },
  { id: "5-ganada", name: "Ganada" },
  { id: "6-perdida", name: "Perdida" },
];

export const CRMInboxConfirmForm = ({
  message,
  onSuccess,
  onCancel,
}: {
  message: CRMMensaje;
  onSuccess?: () => void;
  onCancel?: () => void;
}) => {
  const methods = useForm<FormValues>({
    defaultValues: {
      contacto_nuevo: false,
      contacto_id: undefined,
      contacto_nombre: "",
      contacto_referencia: message.contacto_referencia ?? "",
      contacto_responsable_id: "",
      oportunidad_id: undefined,
      crear_oportunidad: false,
      tipo_operacion_id: "",
      propiedad_id: "",
      responsable_oportunidad_id: "",
      evento_tipo_id: "",
      evento_motivo_id: "",
      evento_asignado_id: "",
      evento_descripcion: "",
      proximo_estado: "",
      fecha_proximo_estado: new Date().toISOString().slice(0, 10),
    },
  });

  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider();
  const { data: identity } = useGetIdentity();

  const [forceNuevaOportunidad, setForceNuevaOportunidad] = useState(false);
  const [autoOportunidad, setAutoOportunidad] = useState<OportunidadAuto | null>(null);
  const [loadingContacto, setLoadingContacto] = useState(false);
  const [tipoOperacionLabel, setTipoOperacionLabel] = useState<string>("");
  const [responsableLabel, setResponsableLabel] = useState<string>("");
  const [eventoTipoDefault, setEventoTipoDefault] = useState<string>("");

  useEffect(() => {
    methods.reset({
      contacto_nuevo: false,
      contacto_id: undefined,
      contacto_nombre: "",
      contacto_referencia: message.contacto_referencia ?? "",
      contacto_responsable_id: identity?.id?.toString() ?? "",
      oportunidad_id: undefined,
      crear_oportunidad: false,
      tipo_operacion_id: "",
      propiedad_id: "",
      responsable_oportunidad_id: identity?.id?.toString() ?? "",
      evento_tipo_id: "",
      evento_motivo_id: "",
      evento_asignado_id: identity?.id?.toString() ?? "",
      evento_descripcion: "",
      proximo_estado: "",
      fecha_proximo_estado: new Date().toISOString().slice(0, 10),
    });
    setAutoOportunidad(null);
    setForceNuevaOportunidad(false);
  }, [message, identity, methods]);
  useEffect(() => {
    methods.register("contacto_referencia");
  }, [methods]);

  useEffect(() => {
    let unsubscribed = false;
    const fetchEventoTipos = async () => {
      try {
        const { data } = await dataProvider.getList("crm/catalogos/tipos-evento", {
          pagination: { page: 1, perPage: 50 },
          sort: { field: "nombre", order: "ASC" },
          filter: {},
        });
        if (!unsubscribed && Array.isArray(data) && data.length > 0) {
          const match =
            data.find((item: any) => item.codigo === message.tipo) ??
            data.find((item: any) => item.tipo === message.tipo) ??
            data[0];
          if (match) {
            setEventoTipoDefault(String(match.id));
          }
        }
      } catch {
        // ignore
      }
    };
    fetchEventoTipos();
    return () => {
      unsubscribed = true;
    };
  }, [dataProvider, message.tipo]);

  useEffect(() => {
    if (eventoTipoDefault) {
      methods.setValue("evento_tipo_id", eventoTipoDefault, { shouldDirty: false });
    }
  }, [eventoTipoDefault, methods]);

  const contactoNuevo = useWatch({ control: methods.control, name: "contacto_nuevo" });
  const crearOportunidad = useWatch({ control: methods.control, name: "crear_oportunidad" });
  const contactoId = useWatch({ control: methods.control, name: "contacto_id" });
  const contactoNombre = useWatch({ control: methods.control, name: "contacto_nombre" }) ?? "";
const contactoResponsableId = useWatch({ control: methods.control, name: "contacto_responsable_id" });
const referenciaValor =
  useWatch({ control: methods.control, name: "contacto_referencia" }) ?? message.contacto_referencia ?? "";
const oportunidadId = useWatch({ control: methods.control, name: "oportunidad_id" });
const propiedadId = useWatch({ control: methods.control, name: "propiedad_id" });
const tipoOperacionId = useWatch({ control: methods.control, name: "tipo_operacion_id" });
const responsableOportunidadId = useWatch({
  control: methods.control,
  name: "responsable_oportunidad_id",
});
const eventoTipoId = useWatch({ control: methods.control, name: "evento_tipo_id" });
const eventoMotivoId = useWatch({ control: methods.control, name: "evento_motivo_id" });
const eventoAsignadoId = useWatch({ control: methods.control, name: "evento_asignado_id" });
const eventoDescripcion = useWatch({ control: methods.control, name: "evento_descripcion" }) ?? "";
const [currentStep, setCurrentStep] = useState(0);

  const handleStepValidate = async (index: number) => {
    if (index === 0) {
      if (contactoNuevo) {
        if (!contactoNombre.trim()) {
          notify("Completa el nombre del contacto nuevo", { type: "warning" });
          return false;
        }
      } else if (!contactoId) {
        notify("Selecciona un contacto existente", { type: "warning" });
        return false;
      }
    }
    if (index === 1) {
      if (crearOportunidad) {
        if (!tipoOperacionId) {
          notify("Selecciona el tipo de operación", { type: "warning" });
          return false;
        }
        if (!propiedadId) {
          notify("Selecciona una propiedad para la oportunidad", { type: "warning" });
          return false;
        }
      } else {
        if (!oportunidadId) {
          notify("Selecciona una oportunidad existente", { type: "warning" });
          return false;
        }
        if (!tipoOperacionId || !propiedadId) {
          notify("La oportunidad seleccionada debe incluir tipo y propiedad", { type: "warning" });
          return false;
        }
      }
    }
    return true;
  };

  useEffect(() => {
    if (contactoNuevo) {
      methods.setValue("contacto_id", undefined);
      methods.setValue("oportunidad_id", undefined);
      methods.setValue("tipo_operacion_id", "");
      methods.setValue("propiedad_id", "");
      setAutoOportunidad(null);
      setForceNuevaOportunidad(true);
      methods.setValue("crear_oportunidad", true);
      return;
    }
    if (!contactoId) {
      setAutoOportunidad(null);
      setForceNuevaOportunidad(false);
      return;
    }
    let ignore = false;
    const fetchContactoData = async () => {
      try {
        setLoadingContacto(true);
        const contactoNumeric = Number(contactoId);
        const { data: contacto } = await dataProvider.getOne("crm/contactos", { id: contactoNumeric });
        if (!ignore && contacto?.nombre_completo) {
          methods.setValue("contacto_nombre", contacto.nombre_completo, { shouldDirty: false });
        }
        const { data: oportunidades } = await dataProvider.getList("crm/oportunidades", {
          pagination: { page: 1, perPage: 1 },
          sort: { field: "created_at", order: "DESC" },
          filter: { contacto_id: contactoNumeric, estado: "1-abierta" },
        });
        if (ignore) {
          return;
        }
        if (Array.isArray(oportunidades) && oportunidades.length > 0) {
          const abierta = oportunidades[0];
          setAutoOportunidad({
            id: abierta.id,
            label: abierta.descripcion_estado || `Oportunidad #${abierta.id}`,
            propiedad_id: abierta.propiedad_id,
            tipo_operacion_id: abierta.tipo_operacion_id,
            responsable_id: abierta.responsable_id,
            tipo_operacion_nombre: abierta.tipo_operacion?.nombre,
            responsable_nombre: abierta.responsable?.nombre,
            estado: abierta.estado,
          });
          setForceNuevaOportunidad(false);
          methods.setValue("crear_oportunidad", false, { shouldDirty: true });
          methods.setValue("oportunidad_id", String(abierta.id), { shouldDirty: true });
          methods.setValue("tipo_operacion_id", abierta.tipo_operacion_id ? String(abierta.tipo_operacion_id) : "", {
            shouldDirty: false,
          });
          methods.setValue("propiedad_id", abierta.propiedad_id ? String(abierta.propiedad_id) : "", {
            shouldDirty: false,
          });
          methods.setValue("proximo_estado", abierta.estado || "", { shouldDirty: false });
        } else {
          setAutoOportunidad(null);
          setForceNuevaOportunidad(true);
          methods.setValue("crear_oportunidad", true);
          methods.setValue("oportunidad_id", undefined);
          methods.setValue("tipo_operacion_id", "");
          methods.setValue("propiedad_id", "");
          methods.setValue("proximo_estado", "", { shouldDirty: false });
        }
      } catch {
        if (!ignore) {
          notify("No se pudo obtener datos del contacto", { type: "warning" });
          setForceNuevaOportunidad(false);
        }
      } finally {
        if (!ignore) {
          setLoadingContacto(false);
        }
      }
    };
    fetchContactoData();
    return () => {
      ignore = true;
    };
  }, [contactoId, contactoNuevo, dataProvider, methods, notify]);

  useEffect(() => {
    if (crearOportunidad) {
      methods.setValue("oportunidad_id", undefined);
      setAutoOportunidad(null);
    }
  }, [crearOportunidad, methods]);

  useEffect(() => {
    if (!crearOportunidad && oportunidadId) {
      let ignore = false;
      const loadOportunidad = async () => {
        try {
          const numericId = Number(oportunidadId);
          if (autoOportunidad && autoOportunidad.id === numericId) {
            return;
          }
          const { data } = await dataProvider.getOne("crm/oportunidades", { id: numericId });
          if (!ignore && data) {
            setAutoOportunidad({
              id: data.id,
              label: data.descripcion_estado || `Oportunidad #${data.id}`,
              propiedad_id: data.propiedad_id,
              tipo_operacion_id: data.tipo_operacion_id,
              responsable_id: data.responsable_id,
              tipo_operacion_nombre: data.tipo_operacion?.nombre,
              responsable_nombre: data.responsable?.nombre,
              estado: data.estado,
            });
            methods.setValue("tipo_operacion_id", data.tipo_operacion_id ? String(data.tipo_operacion_id) : "", {
              shouldDirty: false,
            });
            methods.setValue("propiedad_id", data.propiedad_id ? String(data.propiedad_id) : "", {
              shouldDirty: false,
            });
            methods.setValue("proximo_estado", data.estado || "", { shouldDirty: false });
          }
        } catch {
          if (!ignore) {
            notify("No se pudo cargar la oportunidad seleccionada", { type: "warning" });
          }
        }
      };
      loadOportunidad();
      return () => {
        ignore = true;
      };
    }
  }, [crearOportunidad, oportunidadId, autoOportunidad, dataProvider, notify, methods]);

  const submit = async () => {
    try {
      const values = methods.getValues();
      const payload: Record<string, unknown> = {};
      if (!values.contacto_nuevo && values.contacto_id) {
        payload.contacto_id = Number(values.contacto_id);
      } else if (
        values.contacto_nuevo &&
        values.contacto_nombre &&
        values.contacto_referencia &&
        values.contacto_responsable_id
      ) {
        payload.contacto_nuevo = {
          nombre: values.contacto_nombre,
          referencia: values.contacto_referencia,
          responsable_id: Number(values.contacto_responsable_id),
        };
      } else {
        throw new Error("Selecciona un contacto existente o completá los datos para uno nuevo");
      }

      if (values.oportunidad_id) {
        payload.oportunidad_id = Number(values.oportunidad_id);
      } else if (values.crear_oportunidad) {
        if (!values.tipo_operacion_id || !values.responsable_oportunidad_id || !values.propiedad_id) {
          throw new Error("Completa tipo, responsable y propiedad para la oportunidad nueva");
        }
        payload.oportunidad_nueva = {
          tipo_operacion_id: Number(values.tipo_operacion_id),
          propiedad_id: Number(values.propiedad_id),
          responsable_id: Number(values.responsable_oportunidad_id),
        };
      }

      payload.evento = {
        tipo_id: values.evento_tipo_id ? Number(values.evento_tipo_id) : undefined,
        motivo_id: values.evento_motivo_id ? Number(values.evento_motivo_id) : undefined,
        descripcion: values.evento_descripcion,
        asignado_a_id: values.evento_asignado_id ? Number(values.evento_asignado_id) : undefined,
        proximo_estado: values.proximo_estado || undefined,
        fecha_proximo_estado: values.fecha_proximo_estado || undefined,
      };

      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch(`${API_URL}/crm/mensajes/${message.id}/confirmar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      notify("Mensaje confirmado", { type: "info" });
      onSuccess?.();
      refresh();
    } catch (e: any) {
      notify(e?.message || "No se pudo confirmar", { type: "warning" });
    }
  };

    const oportunidadSummary = useMemo(() => {
    if (crearOportunidad) {
      return (
        <SummaryList
          items={[
            { label: "Modo", value: "Nueva oportunidad" },
            { label: "Propiedad", value: propiedadId ? `ID ${propiedadId}` : "Seleccionar propiedad" },
            { label: "Tipo operación", value: tipoOperacionId || "-" },
            { label: "Responsable", value: responsableOportunidadId ? `ID ${responsableOportunidadId}` : "-" },
          ]}
        />
      );
    }
    return (
      <SummaryList
        items={[
          { label: "Modo", value: "Oportunidad existente" },
          {
            label: "Oportunidad",
            value: autoOportunidad?.label || (oportunidadId ? `ID ${oportunidadId}` : "Sin seleccionar"),
          },
          {
            label: "Propiedad",
            value:
              autoOportunidad?.propiedad_id != null
                ? `ID ${autoOportunidad.propiedad_id}`
                : "Propiedad registrada en CRM",
          },
        ]}
      />
    );
  }, [crearOportunidad, propiedadId, tipoOperacionId, responsableOportunidadId, autoOportunidad, oportunidadId]);

  const respuestaSummary = useMemo(
    () => (
      <SummaryList
        items={[
          { label: "Responsable contacto", value: contactoResponsableId ? `ID ${contactoResponsableId}` : "-" },
          { label: "Tipo evento", value: eventoTipoId || "-" },
          { label: "Motivo", value: eventoMotivoId || "-" },
          { label: "Asignado a", value: eventoAsignadoId ? `ID ${eventoAsignadoId}` : "-" },
          { label: "Descripción", value: eventoDescripcion || "-" },
        ]}
      />
    ),
    [contactoResponsableId, eventoTipoId, eventoMotivoId, eventoAsignadoId, eventoDescripcion]
  );

  useEffect(() => {
    const targetTipoId = crearOportunidad
      ? tipoOperacionId
      : autoOportunidad?.tipo_operacion_id
        ? String(autoOportunidad.tipo_operacion_id)
        : tipoOperacionId;
    if (!targetTipoId) {
      setTipoOperacionLabel("");
      return;
    }

    if (!crearOportunidad && autoOportunidad?.tipo_operacion_nombre) {
      setTipoOperacionLabel(autoOportunidad.tipo_operacion_nombre);
      return;
    }

    let ignore = false;
    const fetchTipo = async () => {
      try {
        const { data } = await dataProvider.getOne("crm/catalogos/tipos-operacion", {
          id: Number(targetTipoId),
        });
        if (!ignore) {
          setTipoOperacionLabel(data?.nombre || `Tipo ${targetTipoId}`);
        }
      } catch {
        if (!ignore) {
          setTipoOperacionLabel(`Tipo ${targetTipoId}`);
        }
      }
    };
    fetchTipo();
    return () => {
      ignore = true;
    };
  }, [crearOportunidad, tipoOperacionId, autoOportunidad?.tipo_operacion_id, autoOportunidad?.tipo_operacion_nombre, dataProvider]);

  useEffect(() => {
    const targetResponsableId = crearOportunidad
      ? responsableOportunidadId
      : autoOportunidad?.responsable_id
        ? String(autoOportunidad.responsable_id)
        : undefined;
    if (!targetResponsableId) {
      setResponsableLabel("");
      return;
    }
    if (!crearOportunidad && autoOportunidad?.responsable_nombre) {
      setResponsableLabel(autoOportunidad.responsable_nombre);
      return;
    }
    let ignore = false;
    const fetchResponsable = async () => {
      try {
        const { data } = await dataProvider.getOne("users", { id: Number(targetResponsableId) });
        if (!ignore) {
          setResponsableLabel(data?.nombre || `ID ${targetResponsableId}`);
        }
      } catch {
        if (!ignore) {
          setResponsableLabel(`ID ${targetResponsableId}`);
        }
      }
    };
    fetchResponsable();
    return () => {
      ignore = true;
    };
  }, [crearOportunidad, responsableOportunidadId, autoOportunidad?.responsable_id, autoOportunidad?.responsable_nombre, dataProvider]);

  const resumenOportunidadTexto = useMemo(() => {
    const tipoTexto = tipoOperacionLabel || (tipoOperacionId ? `Tipo ${tipoOperacionId}` : undefined);
    if (crearOportunidad) {
      const propiedadTexto = propiedadId ? `Propiedad ${propiedadId}` : "Propiedad sin asignar";
      return [tipoTexto, propiedadTexto].filter(Boolean).join(" - ");
    }
    if (autoOportunidad) {
      const propiedadTexto =
        autoOportunidad.label ||
        (autoOportunidad.propiedad_id ? `Propiedad ${autoOportunidad.propiedad_id}` : undefined);
      return [tipoOperacionLabel, propiedadTexto].filter(Boolean).join(" - ");
    }
    if (oportunidadId) {
      return [tipoOperacionLabel, `Oportunidad #${oportunidadId}`].filter(Boolean).join(" - ");
    }
    return tipoOperacionLabel || undefined;
  }, [crearOportunidad, tipoOperacionLabel, propiedadId, autoOportunidad, oportunidadId, tipoOperacionId]);

  const responsableTexto = useMemo(() => {
    if ((crearOportunidad && responsableOportunidadId) || (!crearOportunidad && autoOportunidad?.responsable_id)) {
      return responsableLabel;
    }
    return responsableLabel || undefined;
  }, [crearOportunidad, responsableOportunidadId, autoOportunidad, responsableLabel]);

  const messageBlock = (
    <MessagePreview
      referencia={referenciaValor || message.contacto_referencia || ""}
      asunto={message.asunto}
      contenido={message.contenido}
      contactName={contactoNombre || (contactoId ? `ID ${contactoId}` : undefined)}
      resumenOportunidad={resumenOportunidadTexto}
      responsableTexto={responsableTexto}
    />
  );

  const steps = [
    {
      title: "Contacto",
      content: (
        <div className="space-y-4">
          {messageBlock}
          <SectionCard
            title="Contacto"
            active={currentStep === 0}
            action={
              <Controller
                name="contacto_nuevo"
                control={methods.control}
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Nuevo</span>
                    <Checkbox
                      checked={!!field.value}
                      onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                    />
                  </label>
                )}
              />
            }
          >
            <div className="space-y-2">
              {contactoNuevo ? (
                <Input
                  placeholder="Nombre"
                  {...methods.register("contacto_nombre")}
                  className="flex-1 min-w-0"
                />
              ) : (
                <ComboboxQuery
                  source="contacto_id"
                  resource="crm/contactos"
                  labelField="nombre_completo"
                  placeholder="Buscar contacto"
                  disabled={loadingContacto}
                />
              )}
            </div>
          </SectionCard>
          <SectionCard title="Oportunidad" collapsible defaultCollapsed>
            {oportunidadSummary}
          </SectionCard>
          <SectionCard title="Respuesta" collapsible defaultCollapsed>
            {respuestaSummary}
          </SectionCard>
        </div>
      ),
    },
    {
      title: "Oportunidad",
      content: (
        <div className="space-y-4">
          {messageBlock}
          <SectionCard
            title="Oportunidad"
            active={currentStep === 1}
            action={
              <Controller
                name="crear_oportunidad"
                control={methods.control}
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                    Nueva
                    <Checkbox
                      checked={!!field.value}
                      onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      disabled={forceNuevaOportunidad}
                    />
                  </label>
                )}
              />
            }
          >
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[0.7fr_1fr]">
                <ComboboxQuery
                  source="tipo_operacion_id"
                  resource="crm/catalogos/tipos-operacion"
                  labelField="nombre"
                  placeholder="Tipo de operación"
                  disabled={!crearOportunidad}
                />
                <ComboboxQuery
                  source="propiedad_id"
                  resource="propiedades"
                  labelField="nombre"
                  placeholder={tipoOperacionId ? "Propiedad" : "Selecciona tipo"}
                  disabled={!crearOportunidad || !tipoOperacionId}
                  filter={
                    crearOportunidad && tipoOperacionId
                      ? { tipo_operacion_id: Number(tipoOperacionId) }
                      : undefined
                  }
                  dependsOn={`${tipoOperacionId}-${crearOportunidad}`}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase text-muted-foreground font-medium">Oportunidad existente</p>
                <ComboboxQuery
                  source="oportunidad_id"
                  resource="crm/oportunidades"
                  labelField="descripcion_estado"
                  placeholder="Selecciona una oportunidad"
                  disabled={crearOportunidad || !contactoId || !!contactoNuevo}
                  filter={
                    !contactoNuevo && contactoId
                      ? { contacto_id: Number(contactoId), estado: "1-abierta" }
                      : undefined
                  }
                  dependsOn={`${contactoId ?? "none"}-${crearOportunidad}`}
                />
              </div>
              {crearOportunidad ? (
                <div className="space-y-1">
                  <p className="text-xs uppercase text-muted-foreground font-medium">Responsable</p>
                  <ComboboxQuery
                    source="responsable_oportunidad_id"
                    resource="users"
                    labelField="nombre"
                    placeholder="Selecciona responsable"
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Se vinculará con la oportunidad existente seleccionada.
                </p>
              )}
            </div>
          </SectionCard>
          <SectionCard title="Respuesta" collapsible defaultCollapsed>
            {respuestaSummary}
          </SectionCard>
        </div>
      ),
    },
    {
      title: "Evento / respuesta",
      content: (
        <div className="space-y-4">
          {messageBlock}
          <SectionCard title="Respuesta" collapsible active={currentStep === 2}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs uppercase text-muted-foreground font-medium">Tipo de evento</p>
                <ComboboxQuery
                  source="evento_tipo_id"
                  resource="crm/catalogos/tipos-evento"
                  labelField="nombre"
                  placeholder="Selecciona tipo"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase text-muted-foreground font-medium">Motivo</p>
                <ComboboxQuery
                  source="evento_motivo_id"
                  resource="crm/catalogos/motivos-evento"
                  labelField="nombre"
                  placeholder="Selecciona motivo"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs uppercase text-muted-foreground font-medium">Pr?ximo estado</p>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...methods.register("proximo_estado")}
                >
                  {ESTADO_OPORTUNIDAD_CHOICES.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase text-muted-foreground font-medium">Fecha compromiso</p>
                <Input type="date" {...methods.register("fecha_proximo_estado")} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase text-muted-foreground font-medium">Asignado a</p>
              <ComboboxQuery
                source="evento_asignado_id"
                resource="users"
                labelField="nombre"
                placeholder="Selecciona responsable"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase text-muted-foreground font-medium">Respuesta</p>
              <Textarea
                rows={4}
                {...methods.register("evento_descripcion")}
                placeholder="Detalle la respuesta o acci?n"
              />
            </div>
          </SectionCard>
        </div>
      ),
    },
  ];

  return (
    <FormProvider {...methods}>
      <FormWizard
        steps={steps}
        finishLabel="Confirmar"
        onFinish={submit}
        onStepChange={setCurrentStep}
        onStepValidate={handleStepValidate}
        className="max-h-[70vh] overflow-y-auto pr-2"
      />
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </FormProvider>
  );
};
