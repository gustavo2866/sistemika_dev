/**
 * Solicitudes List Configuration
 * 
 * Declarative configuration for the solicitudes list
 */

import { ListConfig } from "@/components/list/GenericList";
import { solicitudTipoChoices } from "./types";

export const solicitudListConfig: ListConfig = {
  resource: "solicitudes",
  title: "Solicitudes de Compra",
  
  // Pagination and sorting
  perPage: 25,
  defaultSort: { field: "id", order: "DESC" },
  
  // Filters
  filters: [
    {
      source: "q",
      type: "text",
      label: false,
      placeholder: "Buscar solicitudes",
      alwaysOn: true,
    },
    {
      source: "tipo",
      type: "select",
      label: "Tipo",
      choices: solicitudTipoChoices,
      alwaysOn: false,  // Aparece en el menú de filtros
    },
    {
      source: "solicitante_id",
      type: "reference",
      label: "Solicitante",
      reference: "users",
      referenceField: "nombre",
      alwaysOn: false,  // Aparece en el menú de filtros
    },
  ],
  
  // Desktop columns
  columns: [
    {
      source: "id",
      label: "ID",
      sortable: true,
    },
    {
      source: "tipo",
      label: "Tipo",
      type: "choice",
      choices: solicitudTipoChoices,
      sortable: true,
    },
    {
      source: "fecha_necesidad",
      label: "Fecha necesidad",
      type: "date",
      sortable: true,
    },
    {
      source: "solicitante_id",
      label: "Solicitante",
      type: "reference",
      reference: "users",
      referenceField: "nombre",
    },
    {
      source: "comentario",
      label: "Comentario",
      truncate: 50,
    },
  ],
  
  // Row click behavior
  rowClick: (id) => `/solicitudes/${id}/edit-mb`,
  
  // Mobile configuration
  mobile: {
    primaryField: "tipo",
    secondaryFields: ["fecha_necesidad"],
    detailFields: [
      { source: "solicitante_id", type: "reference", reference: "users", referenceField: "nombre" },
      { source: "comentario" },
    ],
    badge: {
      source: "tipo",
      choices: solicitudTipoChoices,
    },
  },
  
  // Actions configuration
  actions: [
    {
      name: "edit",
      label: "Editar",
      icon: "Edit",
      variant: "outline",
      individual: "inline",
      bulk: false,
      action: (ids, { navigate }) => {
        if (ids[0]) {
          navigate(`/solicitudes/${ids[0]}/edit-mb`);
        }
      },
    },
  ],
  
  // Row actions layout
  rowActionsLayout: {
    inline: {
      maxVisible: 1,
      showLabels: false,
    },
  },
};
