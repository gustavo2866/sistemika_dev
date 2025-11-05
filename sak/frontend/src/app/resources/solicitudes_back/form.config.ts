/**
 * Declarative Form Configuration for Solicitudes
 *
 * Defines structure, validation and behaviour for the solicitudes resource.
 */

import { FormConfig } from "@/components/form/GenericForm/types";
import {
  SolicitudFormValues,
  DetalleItem,
  solicitudTipoChoices,
} from "./types";
import { truncateString } from "@/components/form/utils";

export const solicitudFormConfig: FormConfig<SolicitudFormValues> = {
  resource: "solicitudes",
  title: "Solicitud de Compra",
  submitLabel: "Guardar Solicitud",
  cancelLabel: "Cancelar",
  enableEnterKeyNavigation: true,
  redirectAfterSave: "/solicitudes",

  sections: [
    {
      title: "Datos Generales",
      description: "Información básica de la solicitud",
      defaultOpen: true,
      defaultOpenBehavior: "create-only",
      showTitleSubtitle: true,
      fields: [
        {
          name: "tipo",
          label: "Tipo de Solicitud",
          type: "select",
          required: true,
          isTitle: true,
          options: solicitudTipoChoices.map((choice) => ({
            value: choice.id,
            label: choice.name,
          })),
          validations: [
            {
              type: "required",
              message: "El tipo de solicitud es requerido",
            },
          ],
        },
        {
          name: "fecha_necesidad",
          label: "Fecha de Necesidad",
          type: "date",
          required: true,
          isTitle: true,
          validations: [
            {
              type: "required",
              message: "La fecha de necesidad es requerida",
            },
          ],
        },
        {
          name: "solicitante_id",
          label: "Solicitante",
          type: "reference",
          reference: "users",
          referenceSource: "nombre",
          required: true,
          fullWidth: true,
          validations: [
            {
              type: "required",
              message: "El solicitante es requerido",
            },
          ],
        },
        {
          name: "comentario",
          label: "Comentarios Adicionales",
          type: "textarea",
          placeholder: "Ingrese comentarios o información adicional...",
          fullWidth: true,
        },
      ],
    },
    {
      title: "Artículos seleccionados",
      description: "Detalle de los artículos que se solicitan",
      defaultOpen: true,
      detailItems: {
        name: "detalles",
        config: {
          fields: [
            {
              name: "articulo_id",
              label: "Artículo",
              type: "combobox",
              required: true,
              searchable: true,
              placeholder: "Buscar artículo...",
              reference: "articulos",
              referenceSource: "nombre",
              validations: [
                {
                  type: "required",
                  message: "Debe seleccionar un artículo",
                },
              ],
            },
            {
              name: "descripcion",
              label: "Descripción",
              type: "text",
              required: true,
              placeholder: "Ingrese descripción...",
              validations: [
                {
                  type: "required",
                  message: "La descripción es requerida",
                },
              ],
            },
            {
              name: "unidad_medida",
              label: "Unidad de Medida",
              type: "text",
              required: true,
              placeholder: "Ej: UN, KG, LT...",
              validations: [
                {
                  type: "required",
                  message: "La unidad de medida es requerida",
                },
              ],
            },
            {
              name: "cantidad",
              label: "Cantidad",
              type: "number",
              required: true,
              min: 0.01,
              step: 0.01,
              validations: [
                {
                  type: "required",
                  message: "La cantidad es requerida",
                },
                {
                  type: "min",
                  value: 0.01,
                  message: "La cantidad debe ser mayor a 0",
                },
              ],
            },
          ],
          defaultItem: () => ({
            articulo_id: null,
            articulo_nombre: "",
            descripcion: "",
            unidad_medida: "",
            cantidad: 0,
          }),
          getCardTitle: (item: DetalleItem) =>
            truncateString(item.descripcion || "Sin descripción", 50),
          getCardDescription: (item: DetalleItem) => {
            if (item.cantidad && item.unidad_medida) {
              return `${item.cantidad} ${item.unidad_medida}`;
            }
            return "Sin cantidad especificada";
          },
          getCardBadge: (item: DetalleItem) =>
            item.articulo_nombre ||
            (item.articulo_id ? "Artículo seleccionado" : "Sin artículo"),
          validateItem: (item: DetalleItem) => {
            const errors: Record<string, string> = {};
            if (!item.articulo_id) {
              errors.articulo_id = "Debe seleccionar un artículo";
            }
            if (!item.descripcion?.trim()) {
              errors.descripcion = "La descripción es requerida";
            }
            if (!item.unidad_medida?.trim()) {
              errors.unidad_medida = "La unidad de medida es requerida";
            }
            if (!item.cantidad || item.cantidad <= 0) {
              errors.cantidad = "La cantidad debe ser mayor a 0";
            }
            return errors;
          },
          minItems: 1,
        },
      },
    },
  ],

  validate: (data: SolicitudFormValues) => {
    const errors: Record<string, string> = {};

    if (!data.tipo) {
      errors.tipo = "El tipo es requerido";
    }
    if (!data.fecha_necesidad) {
      errors.fecha_necesidad = "La fecha de necesidad es requerida";
    }
    if (!data.detalles || data.detalles.length === 0) {
      errors.detalles = "Debe agregar al menos un artículo";
    }

    return errors;
  },

  onBeforeSave: async (data: SolicitudFormValues) => {
    // Aquí se pueden hacer transformaciones antes de guardar
    return {
      ...data,
      comentario: data.comentario?.trim() || "",
      detalles: data.detalles.map((det) => ({
        ...det,
        descripcion: det.descripcion.trim(),
        unidad_medida: det.unidad_medida.trim(),
      })),
    };
  },
};
