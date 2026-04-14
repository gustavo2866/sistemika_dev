"use client";

import type { SetupItem } from "@/components/forms/form_order";
import {
  EmprendimientoCreate,
  EmprendimientoEdit,
  EmprendimientoList,
} from "../emprendimientos";
import {
  ContratoCreate,
  ContratoEdit,
  ContratoList,
} from "../contratos";
import {
  PropietarioCreate,
  PropietarioEdit,
  PropietarioList,
} from "../propietarios";

export const PROPIEDADES_CONFIG_ITEMS: SetupItem[] = [
  {
    key: "propietarios",
    label: "Propietarios",
    description: "Mantiene los titulares vinculados a las propiedades.",
    resource: "propietarios",
    listComponent: PropietarioList,
    createComponent: PropietarioCreate,
    editComponent: PropietarioEdit,
  },
  {
    key: "emprendimientos",
    label: "Emprendimientos",
    description: "Administra los desarrollos y agrupadores inmobiliarios.",
    resource: "emprendimientos",
    listComponent: EmprendimientoList,
    createComponent: EmprendimientoCreate,
    editComponent: EmprendimientoEdit,
  },
  {
    key: "contratos",
    label: "Contratos",
    description: "Administra contratos vinculados a propiedades e inquilinos.",
    resource: "contratos",
    listComponent: ContratoList,
    createComponent: ContratoCreate,
    editComponent: ContratoEdit,
  },
];

export const getPropiedadesConfigItem = (key?: string | null) =>
  PROPIEDADES_CONFIG_ITEMS.find((item) => item.key === key);
