"use client";

import type { SetupItem } from "@/components/forms/form_order";
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
import {
  ErpRubroCreate,
  ErpRubroEdit,
  ErpRubroList,
} from "@/app/resources/erp/rubros";
import {
  ErpCuentaCreate,
  ErpCuentaEdit,
  ErpCuentaList,
} from "@/app/resources/erp/cuentas";

const PROYECTO_SETUP_ITEMS: SetupItem[] = [
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

const ERP_SETUP_ITEMS: SetupItem[] = [
  {
    key: "erp-rubros",
    label: "Rubros ERP",
    description: "Configurar rubros y cuentas contables para constructora.",
    resource: "erp/rubros",
    listComponent: ErpRubroList,
    createComponent: ErpRubroCreate,
    editComponent: ErpRubroEdit,
  },
  {
    key: "erp-cuentas",
    label: "Cuentas ERP",
    description: "Configurar cuentas contables y su concepto de proyecto asociado.",
    resource: "erp/cuentas",
    listComponent: ErpCuentaList,
    createComponent: ErpCuentaCreate,
    editComponent: ErpCuentaEdit,
  },
];

export const CONSTRUCTORA_SETUP_ITEMS: SetupItem[] = [
  ...PROYECTO_SETUP_ITEMS,
  ...TARJA_SETUP_ITEMS,
  ...ERP_SETUP_ITEMS,
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
  {
    key: "erp",
    label: "ERP",
    items: ERP_SETUP_ITEMS,
  },
] as const;

export const getConstructoraSetupItem = (key?: string | null) =>
  CONSTRUCTORA_SETUP_ITEMS.find((item) => item.key === key);
