"use client";

import type { SetupItem } from "@/components/forms/form_order";
import {
  ProyFaseCreate,
  ProyFaseEdit,
  ProyFaseList,
} from "@/app/resources/constructora/proy-fases";
import {
  ProyectoMacrorubroCreate,
  ProyectoMacrorubroEdit,
  ProyectoMacrorubroList,
} from "@/app/resources/constructora/proyectos-macrorubros";
import {
  ProyectoConceptoCreate,
  ProyectoConceptoEdit,
  ProyectoConceptoList,
} from "@/app/resources/constructora/proyectos-conceptos";
import {
  ParteDiarioEstadoCreate,
  ParteDiarioEstadoEdit,
  ParteDiarioEstadoList,
} from "@/app/resources/constructora/parte-diario-estados";

const PROYECTO_SETUP_ITEMS: SetupItem[] = [
  {
    key: "proy-fases",
    label: "Fases de Proyecto",
    description: "Configurar fases disponibles para los proyectos.",
    resource: "proy-fases",
    listComponent: ProyFaseList,
    createComponent: ProyFaseCreate,
    editComponent: ProyFaseEdit,
  },
  {
    key: "proyectos-macrorubros",
    label: "Macrorubros de Proyecto",
    description: "Configurar macrorubros disponibles para presupuestos de proyecto.",
    resource: "constructora/proyectos-macrorubros",
    listComponent: ProyectoMacrorubroList,
    createComponent: ProyectoMacrorubroCreate,
    editComponent: ProyectoMacrorubroEdit,
  },
  {
    key: "proyectos-conceptos",
    label: "Conceptos de Proyecto",
    description: "Configurar conceptos disponibles para presupuestos de proyecto.",
    resource: "constructora/proyectos-conceptos",
    listComponent: ProyectoConceptoList,
    createComponent: ProyectoConceptoCreate,
    editComponent: ProyectoConceptoEdit,
  },
];

const TARJA_SETUP_ITEMS: SetupItem[] = [
  {
    key: "parte-diario-estados",
    label: "Estados de tarja",
    description: "Configurar estados disponibles para los detalles de tarja.",
    resource: "parte-diario-estados",
    listComponent: ParteDiarioEstadoList,
    createComponent: ParteDiarioEstadoCreate,
    editComponent: ParteDiarioEstadoEdit,
  },
];

export const CONSTRUCTORA_SETUP_ITEMS: SetupItem[] = [
  ...PROYECTO_SETUP_ITEMS,
  ...TARJA_SETUP_ITEMS,
];

export const CONSTRUCTORA_SETUP_GROUPS = [
  {
    key: "proyecto",
    label: "Proyecto",
    items: PROYECTO_SETUP_ITEMS,
  },
  {
    key: "tarja",
    label: "Tarja",
    items: TARJA_SETUP_ITEMS,
  },
] as const;

export const getConstructoraSetupItem = (key?: string | null) =>
  CONSTRUCTORA_SETUP_ITEMS.find((item) => item.key === key);
