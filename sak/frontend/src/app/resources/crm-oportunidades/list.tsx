"use client";

import { useMemo, useState } from "react";
import {
  useDataProvider,
  useGetList,
  useListContext,
  useNotify,
  useRedirect,
  useRefresh,
  useResourceContext,
} from "ra-core";
import { MoreHorizontal, Target } from "lucide-react";
import { List } from "@/components/list";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ResourceTitle } from "@/components/resource-title";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CRM_OPORTUNIDAD_ESTADOS,
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  CRM_OPORTUNIDAD_ESTADO_CHOICES,
  formatEstadoOportunidad,
  type CRMOportunidad,
  type CRMOportunidadEstado,
} from "./model";

type ContactoRecord = {
  id: number | string;
  nombre_completo?: string;
  nombre?: string;
};

type ResponsableRecord = {
  id: number | string;
  nombre?: string;
  nombre_completo?: string;
  email?: string;
  avatar?: string | null;
  url_foto?: string | null;
};

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar oportunidades" alwaysOn />,
  <SelectInput key="estado" source="estado" label="Estado" choices={CRM_OPORTUNIDAD_ESTADO_CHOICES} emptyText="Todos" />,
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput
    key="tipo_operacion_id"
    source="tipo_operacion_id"
    reference="crm/catalogos/tipos-operacion"
    label="Tipo de operación"
    alwaysOn
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="propiedad_id" source="propiedad_id" reference="propiedades" label="Propiedad">
    <SelectInput optionText="nombre" emptyText="Todas" />
  </ReferenceInput>,
  <TextInput key="propiedad.tipo" source="propiedad.tipo" label="Tipo de propiedad" />,
  <ReferenceInput key="emprendimiento_id" source="emprendimiento_id" reference="emprendimientos" label="Emprendimiento">
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
];

const ListActions = () => (
  <div className="flex items-center gap-2 flex-wrap">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const CRMOportunidadList = () => (
  <List
    title={<ResourceTitle icon={Target} text="CRM - Oportunidades" />}
    filters={filters}
    actions={<ListActions />}
    perPage={10}
    sort={{ field: "created_at", order: "DESC" }}
    className="space-y-5"
  >
    <OportunidadAccordionList />
  </List>
);

const OportunidadAccordionList = () => {
  const { data = [], isLoading } = useListContext<CRMOportunidad>();
  const { data: contactos = [] } = useGetList<ContactoRecord>("crm/contactos", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "nombre_completo", order: "ASC" },
  });
  const { data: responsables = [] } = useGetList<ResponsableRecord>("users", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "nombre", order: "ASC" },
  });

  const contactoMap = useMemo(
    () =>
      new Map(
        contactos.map((contacto) => [Number(contacto.id), contacto])
      ),
    [contactos]
  );
  const responsableMap = useMemo(
    () =>
      new Map(
        responsables.map((responsable) => [Number(responsable.id), responsable])
      ),
    [responsables]
  );

  const grouped = useMemo(() => {
    const base = CRM_OPORTUNIDAD_ESTADOS.reduce(
      (acc, estado) => {
        acc[estado] = [];
        return acc;
      },
      {} as Record<CRMOportunidadEstado, CRMOportunidad[]>
    );
    data.forEach((item) => {
      const estado = item.estado ?? "1-abierta";
      if (!base[estado]) {
        base[estado] = [];
      }
      base[estado].push(item);
    });
    return base;
  }, [data]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando oportunidades...</div>;
  }

  return (
    <Accordion
      type="multiple"
      defaultValue={[...CRM_OPORTUNIDAD_ESTADOS]}
      className="space-y-3"
    >
      {CRM_OPORTUNIDAD_ESTADOS.map((estado) => {
        const items = grouped[estado] ?? [];
        const estadoLabel = formatEstadoOportunidad(estado);
        return (
          <AccordionItem
            key={estado}
            value={estado}
            className="rounded-2xl border border-slate-200/70 bg-white/90 px-2 shadow-sm"
          >
            <AccordionTrigger className="px-2 py-3 hover:no-underline">
              <div className="flex w-full items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={
                      CRM_OPORTUNIDAD_ESTADO_BADGES[estado] ?? "bg-slate-100 text-slate-800"
                    }
                  >
                    {estadoLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {items.length} oportunidades
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-3 pt-0">
              {items.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sin oportunidades</div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <OportunidadCard
                      key={item.id}
                      record={item}
                      contacto={contactoMap.get(Number(item.contacto_id))}
                      responsable={responsableMap.get(Number(item.responsable_id))}
                    />
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};

const OportunidadCard = ({
  record,
  contacto,
  responsable,
}: {
  record: CRMOportunidad;
  contacto?: ContactoRecord;
  responsable?: ResponsableRecord;
}) => {
  const redirect = useRedirect();
  const resource = useResourceContext();
  const contactName =
    contacto?.nombre_completo ||
    contacto?.nombre ||
    `Contacto #${record.contacto_id}`;
  const responsableName =
    responsable?.nombre ||
    responsable?.nombre_completo ||
    responsable?.email ||
    `Usuario #${record.responsable_id}`;
  const avatarUrl = responsable?.avatar ?? responsable?.url_foto ?? null;
  const initials = buildInitials(responsableName);
  const titulo = record.titulo?.trim() || "Sin título";
  const fecha = formatShortDate(record.created_at);
  const numero = formatOportunidadId(record.id);

  const handleEdit = () => {
    if (!resource) return;
    redirect("edit", resource, record.id);
  };

  return (
    <Card
      className="cursor-pointer rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      onClick={handleEdit}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-8 border border-slate-200 shadow-sm">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={responsableName} /> : null}
            <AvatarFallback className="bg-slate-100 text-[10px] font-semibold uppercase text-slate-600">
              {initials}
            </AvatarFallback>
          </Avatar>
          <p className="text-sm font-semibold text-slate-900 truncate">
            {contactName}
          </p>
        </div>
        <OportunidadCardMenu record={record} />
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        {fecha} ({numero})
      </div>
      <div className="mt-2 text-sm font-medium text-slate-900">
        {titulo}
      </div>
    </Card>
  );
};

const OportunidadCardMenu = ({ record }: { record: CRMOportunidad }) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const resource = useResourceContext();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const stopCardClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMenuAction = (
    event: React.MouseEvent,
    callback: () => void,
  ) => {
    stopCardClick(event);
    if (busyAction !== null) {
      return;
    }
    callback();
  };

  const handleDelete = async () => {
    if (!resource || !record?.id) return;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("¿Seguro que deseas eliminar la oportunidad?");
      if (!confirmed) return;
    }
    setBusyAction("delete");
    try {
      await dataProvider.delete(resource, { id: record.id });
      notify("Oportunidad eliminada", { type: "info" });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar la oportunidad", { type: "warning" });
    } finally {
      setBusyAction(null);
    }
  };

  const handleEdit = () => {
    if (!resource) return;
    redirect("edit", resource, record.id);
  };

  const handlePlaceholder = (label: string) => {
    notify(`Acción "${label}" pendiente de configurar`, { type: "info" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={busyAction !== null}
          onClick={stopCardClick}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={(event) => handleMenuAction(event, handleEdit)}
          disabled={busyAction !== null}
        >
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => handleMenuAction(event, handleDelete)}
          disabled={busyAction !== null}
          variant="destructive"
        >
          Eliminar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(event) => handleMenuAction(event, () => handlePlaceholder("Confirmar"))}
        >
          Confirmar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => handleMenuAction(event, () => handlePlaceholder("Agendar"))}
        >
          Agendar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => handleMenuAction(event, () => handlePlaceholder("Cotizar"))}
        >
          Cotizar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => handleMenuAction(event, () => handlePlaceholder("Reservar"))}
        >
          Reservar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => handleMenuAction(event, () => handlePlaceholder("Realizar"))}
        >
          Realizar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR");
};

const formatOportunidadId = (value: number) => `#${String(value).padStart(6, "0")}`;

const buildInitials = (name: string) => {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
};

export default CRMOportunidadList;
