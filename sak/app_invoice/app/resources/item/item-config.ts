import React from "react";
import { Package, User } from "lucide-react";
import { 
  ResourceListConfig
} from "@/components/wrappers/resource-list-wrapper";
import { 
  ResourceFormConfig
} from "@/components/wrappers/resource-form-wrapper";
import { BulkConfirmButton } from "@/components/bulk-confirm-button";
import { BulkProcessButton } from "@/components/bulk-process-button";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { BulkExportButton } from "@/components/bulk-export-button";

// Configuración para Items List
export const itemListConfig: ResourceListConfig = {
  filters: [
    {
      source: "q",
      label: false,
      placeholder: "Buscar items por nombre...",
      alwaysOn: true,
    },
    {
      source: "name",
      label: "Nombre",
      placeholder: "Filtrar por nombre",
    },
    {
      source: "description",
      label: "Descripción",
      placeholder: "Filtrar por descripción",
    },
    {
      source: "user_id",
      label: "Usuario",
      type: "reference",
      reference: "users",
    },
  ],
  columns: [
    { source: "id", type: "id" },
    { source: "name", type: "text", label: "Nombre" },
    { source: "description", type: "text", label: "Descripción" },
    { 
      source: "user_id", 
      type: "reference",
      label: "Usuario",
      reference: "users"
    },
    { type: "actions" },
  ],
  perPage: 10,
  debounce: 300,
  bulkActions: React.createElement(
    React.Fragment,
    null,
    React.createElement(BulkConfirmButton),
    React.createElement(BulkProcessButton),
    React.createElement(BulkExportButton),
    React.createElement(BulkDeleteButton)
  ),
};

// Configuración para Items Form
export const itemFormConfig: ResourceFormConfig = {
  sections: [
    {
      title: "Información General",
      icon: React.createElement(Package),
      fields: [
        {
          source: "name",
          type: "text",
          label: "Nombre",
          required: true,
          placeholder: "Ingrese el nombre del item"
        },
        {
          source: "description",
          type: "text",
          label: "Descripción",
          placeholder: "Ingrese una descripción detallada"
        }
      ]
    },
    {
      title: "Asignación", 
      icon: React.createElement(User),
      fields: [
        {
          source: "user_id",
          type: "reference",
          label: "Usuario",
          reference: "users",
          required: true
        }
      ]
    }
  ]
};

// Exportar configuraciones
export { itemListConfig as listConfig, itemFormConfig as formConfig };
