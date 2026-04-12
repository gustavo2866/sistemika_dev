"use client";

import type { SetupItem } from "@/components/forms/form_order";
import { PropiedadesStatusCreate, PropiedadesStatusEdit, PropiedadesStatusList } from "./propiedades-status";
import { TipoActualizacionCreate, TipoActualizacionEdit, TipoActualizacionList } from "./tipos-actualizacion";
import { TipoPropiedadCreate, TipoPropiedadEdit, TipoPropiedadList } from "./tipos-propiedad";
import { TipoContratoCreate, TipoContratoEdit, TipoContratoList } from "./tipos-contrato";

export const INMOBILIARIA_SETUP_ITEMS: SetupItem[] = [
  {
    key: "tipos-propiedad",
    label: "Tipos de propiedad",
    description: "Configura las categorias base de inmuebles disponibles en el modulo.",
    resource: "tipos-propiedad",
    listComponent: TipoPropiedadList,
    createComponent: TipoPropiedadCreate,
    editComponent: TipoPropiedadEdit,
  },
  {
    key: "propiedades-status",
    label: "Estados de propiedad",
    description: "Administra los estados operativos y su catalogo de soporte.",
    resource: "propiedades-status",
    listComponent: PropiedadesStatusList,
    createComponent: PropiedadesStatusCreate,
    editComponent: PropiedadesStatusEdit,
  },
  {
    key: "tipos-actualizacion",
    label: "Tipos de actualizacion",
    description: "Define reglas y catalogos para actualizaciones contractuales.",
    resource: "tipos-actualizacion",
    listComponent: TipoActualizacionList,
    createComponent: TipoActualizacionCreate,
    editComponent: TipoActualizacionEdit,
  },
  {
    key: "tipos-contrato",
    label: "Tipos de contrato",
    description: "Configura las categorias de contratos disponibles en el modulo.",
    resource: "tipos-contrato",
    listComponent: TipoContratoList,
    createComponent: TipoContratoCreate,
    editComponent: TipoContratoEdit,
  },
];

export const getInmobiliariaSetupItem = (key?: string | null) =>
  INMOBILIARIA_SETUP_ITEMS.find((item) => item.key === key);
