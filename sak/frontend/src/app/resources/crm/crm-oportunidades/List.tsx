"use client";

import { useEffect, useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
} from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Pencil, Target, Trash2, Workflow } from "lucide-react";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  IdentityFilterSync,
  ListColumn,
  ListEstado,
  ListID,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  SectionBaseTemplate,
  buildListFilters,
  useIdentityFilterDefaults,
} from "@/components/forms/form_order";
import { List } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  canUseOportunidadAction,
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  CRM_OPORTUNIDAD_ESTADO_CHOICES,
  isClosedOportunidad,
  isProspectOportunidad,
} from "./model";
import { captureOportunidadModalBackground } from "./modal_background";

//#region Base CRUD: configuracion del listado

const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "tipo_operacion_id",
        reference: "crm/catalogos/tipos-operacion",
        label: "Tipo operacion",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: CRM_OPORTUNIDAD_ESTADO_CHOICES,
        optionText: "name",
        optionValue: "id",
        emptyText: "Todos",
        className: "w-[80px]",
        alwaysOn: true,
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "responsable_id",
        reference: "users",
        label: "Responsable",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "contacto_id",
        reference: "crm/contactos",
        label: "Contacto",
      },
      selectProps: {
        optionText: "nombre_completo",
        className: "w-full",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "propiedad_id",
        reference: "propiedades",
        label: "Propiedad",
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todas",
      },
    },
    {
      type: "text",
      props: {
        source: "propiedad.tipo",
        label: "Tipo de propiedad",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "emprendimiento_id",
        reference: "emprendimientos",
        label: "Emprendimiento",
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "crm-oportunidades" },
);

const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const LIST_CONTAINER_CLASS_NAME = "max-w-[980px] w-full mr-auto";
const LIST_TABLE_CLASS_NAME = "text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]";
const COMPACT_LIST_TABLE_CLASS_NAME = "text-[10px] [&_th]:text-[10px] [&_td]:text-[10px]";

//#endregion Base CRUD: configuracion del listado

//#region Fuera del patron: helpers de presentacion enriquecida

const getInitials = (value?: string) => {
  if (!value) return "";

  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
};

const buildListReturnTo = (pathname: string, search: string) =>
  `${pathname}${search}`;

const oportunidadRowClass = (record: any) =>
  record?.activo === false
    ? "text-muted-foreground/70 bg-muted/20 hover:bg-muted/30"
    : undefined;

//#endregion Fuera del patron: helpers de presentacion enriquecida

//#region Fuera del patron: celdas enriquecidas del listado

const ContactoTituloCell = () => (
  <div className="flex flex-col gap-0">
    <ReferenceField source="contacto_id" reference="crm/contactos" link={false}>
      <ListText source="nombre_completo" className="font-medium" />
    </ReferenceField>
    <ListText
      source="titulo"
      className="text-[8px] text-muted-foreground leading-tight"
    />
    <ReferenceField
      source="tipo_operacion_id"
      reference="crm/catalogos/tipos-operacion"
      link={false}
    >
      <ListText
        source="nombre"
        className="text-[8px] text-muted-foreground leading-tight"
      />
    </ReferenceField>
  </div>
);

const ResponsableAvatar = () => {
  const record = useRecordContext<any>();
  const name = record?.nombre ?? record?.fullName ?? record?.email ?? "";
  const initials = getInitials(name);
  const avatarUrl = record?.avatar ?? record?.url_foto ?? "";

  return (
    <Avatar className="size-6 border border-slate-200">
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
      <AvatarFallback className="bg-slate-100 text-[9px] font-semibold text-slate-600">
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
};

const DescripcionCell = () => {
  const record = useRecordContext<any>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(String(record?.descripcion_estado ?? ""));
  }, [open, record?.descripcion_estado]);

  if (!record) return null;

  const handleSave = async () => {
    if (!record?.id || saving) return;

    setSaving(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: { descripcion_estado: value },
        previousData: record,
      });
      notify("Descripcion actualizada", { type: "info" });
      setOpen(false);
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar la descripcion", { type: "warning" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group block w-full text-left"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}
            data-row-click="ignore"
            aria-label="Editar descripcion"
            title="Editar descripcion"
          >
            <span className="inline-block w-full whitespace-normal break-words line-clamp-3 rounded-sm px-1 text-[9px] text-foreground/90 transition group-hover:bg-amber-100/80">
              {record.descripcion_estado ? record.descripcion_estado : "-"}
              <Pencil className="ml-1 inline-block h-2.5 w-2.5 text-amber-700/70 opacity-0 transition group-hover:opacity-100 group-hover:text-amber-700 align-[-1px]" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          className="w-72 border-none bg-transparent p-0 shadow-none"
        >
          <SectionBaseTemplate
            title="Editar descripcion"
            main={
              <div className="space-y-2">
                <Textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="min-h-[80px] !text-[9px] !leading-tight px-2 py-1"
                  placeholder="Escribe una descripcion..."
                />
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    disabled={saving}
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    disabled={saving}
                    onClick={handleSave}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            }
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

//#endregion Fuera del patron: celdas enriquecidas del listado

//#region Fuera del patron: acciones operativas y contexto

const OportunidadEliminarMenuItem = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = buildListReturnTo(location.pathname, location.search);

  if (!record?.id || !isProspectOportunidad(record.estado)) return null;

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.stopPropagation();
        const recordPayload = {
          id: record.id,
          contacto_id: record.contacto_id,
          titulo: record.titulo,
          descripcion_estado: record.descripcion_estado,
          fecha_estado: record.fecha_estado,
          created_at: record.created_at,
        };
        navigate(`/crm/oportunidades/${record.id}/accion_descartar`, {
          state: {
            returnTo,
            record: recordPayload,
            background: captureOportunidadModalBackground(),
          },
        });
      }}
      onClick={(event) => event.stopPropagation()}
      data-row-click="ignore"
      className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      variant="destructive"
    >
      <Trash2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Eliminar
    </DropdownMenuItem>
  );
};

const OportunidadAceptarMenuItem = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = buildListReturnTo(location.pathname, location.search);

  if (!record?.id || !isProspectOportunidad(record.estado)) return null;

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.stopPropagation();
        navigate(`/crm/oportunidades/${record.id}/accion_aceptar`, {
          state: {
            returnTo,
            background: captureOportunidadModalBackground(),
          },
        });
      }}
      onClick={(event) => event.stopPropagation()}
      data-row-click="ignore"
      className="px-1.5 py-1 text-[8px] sm:text-[10px]"
    >
      <CheckCircle2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
      Confirmar
    </DropdownMenuItem>
  );
};

const OportunidadCambioEstadoMenu = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = buildListReturnTo(location.pathname, location.search);

  if (!record?.id || isClosedOportunidad(record.estado) || isProspectOportunidad(record.estado)) {
    return null;
  }

  const canAgendar = canUseOportunidadAction(record.estado, "agendar");
  const canCotizar = canUseOportunidadAction(record.estado, "cotizar");
  const canReservar = canUseOportunidadAction(record.estado, "reservar");
  const canCerrar = canUseOportunidadAction(record.estado, "cerrar");
  const goTo = (path: string) => {
    navigate(path, {
      state: {
        returnTo,
        background: captureOportunidadModalBackground(),
      },
    });
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        onClick={(event) => event.stopPropagation()}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      >
        <Workflow className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
        Cambiar estado
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-28 sm:w-36">
        {canAgendar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_agendar`);
            }}
            onClick={(event) => event.stopPropagation()}
            data-row-click="ignore"
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            Agendar
          </DropdownMenuItem>
        ) : null}
        {canCotizar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_cotizar`);
            }}
            onClick={(event) => event.stopPropagation()}
            data-row-click="ignore"
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            Cotizar
          </DropdownMenuItem>
        ) : null}
        {canReservar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_reservar`);
            }}
            onClick={(event) => event.stopPropagation()}
            data-row-click="ignore"
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            Reservar
          </DropdownMenuItem>
        ) : null}
        {canCerrar ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              goTo(`/crm/oportunidades/${record.id}/accion_cerrar`);
            }}
            onClick={(event) => event.stopPropagation()}
            data-row-click="ignore"
            className="px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            Cerrar
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

//#endregion Fuera del patron: acciones operativas y contexto

//#region Base CRUD: componentes principales

const CRMOportunidadListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);

type CRMOportunidadListBodyProps = {
  identityId?: number | string;
  compact?: boolean;
  showBulkActions?: boolean;
  rowClick?: "edit" | "show" | "expand" | false | undefined;
  className?: string;
};

export const CRMOportunidadListBody = ({
  identityId,
  compact = false,
  showBulkActions = true,
  rowClick = "edit",
  className,
}: CRMOportunidadListBodyProps) => (
  <>
    {identityId ? (
      <IdentityFilterSync identityId={identityId} source="responsable_id" />
    ) : null}
    <ResponsiveDataTable
      rowClick={rowClick}
      bulkActionsToolbar={
        showBulkActions ? <FormOrderBulkActionsToolbar /> : undefined
      }
      bulkActionButtons={showBulkActions ? undefined : false}
      compact={compact}
      rowClassName={oportunidadRowClass}
      className={cn(
        compact ? COMPACT_LIST_TABLE_CLASS_NAME : LIST_TABLE_CLASS_NAME,
        className,
      )}
    >
      <ListColumn source="id" label="ID" className="w-[40px] text-center">
        <ListID source="id" widthClass="w-[40px]" />
      </ListColumn>
      <ListColumn source="contacto_id" label="Contacto" className="w-[100px]">
        <ContactoTituloCell />
      </ListColumn>
      <ListColumn source="estado" label="Estado" className="w-[75px]">
        <ListEstado source="estado" statusClasses={CRM_OPORTUNIDAD_ESTADO_BADGES} />
      </ListColumn>
      <ListColumn source="responsable_id" label="Resp" className="w-[60px]">
        <ReferenceField source="responsable_id" reference="users" link={false}>
          <ResponsableAvatar />
        </ReferenceField>
      </ListColumn>
      <ListColumn
        source="descripcion_estado"
        label="Descripcion"
        className="w-[140px]"
      >
        <DescripcionCell />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[70px]">
        <FormOrderListRowActions
          showDelete={false}
          extraMenuItems={
            <>
              <OportunidadEliminarMenuItem />
              <OportunidadAceptarMenuItem />
              <OportunidadCambioEstadoMenu />
            </>
          }
        />
      </ListColumn>
    </ResponsiveDataTable>
  </>
);

export const CRMOportunidadList = () => <ListaOportunidades />;

const ListaOportunidades = () => {
  const { identityId, defaultFilters } = useIdentityFilterDefaults({
    source: "responsable_id",
  });

  return (
    <List
      title={
        <span className="inline-flex items-center gap-2">
          <Target className="h-4 w-4" />
          CRM Oportunidades
        </span>
      }
      filters={LIST_FILTERS}
      actions={<CRMOportunidadListActions />}
      debounce={300}
      perPage={10}
      containerClassName={LIST_CONTAINER_CLASS_NAME}
      pagination={<ListPaginator />}
      sort={{ field: "created_at", order: "DESC" }}
      filterDefaultValues={defaultFilters}
    >
      <CRMOportunidadListBody identityId={identityId} />
    </List>
  );
};

export default CRMOportunidadList;

//#endregion Base CRUD: componentes principales
