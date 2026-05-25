"use client";

import type { SetupItem } from "@/components/forms/form_order";
import {
  ProyFaseCreate,
  ProyFaseEdit,
  ProyFaseList,
} from "@/app/resources/constructora/proy-fases";

export const CONSTRUCTORA_SETUP_ITEMS: SetupItem[] = [
  {
    key: "proy-fases",
    label: "Fases de Proyecto",
    description: "Configurar fases disponibles para los proyectos.",
    resource: "proy-fases",
    listComponent: ProyFaseList,
    createComponent: ProyFaseCreate,
    editComponent: ProyFaseEdit,
  },
];

export const CONSTRUCTORA_SETUP_GROUPS = [
  {
    key: "proyecto",
    label: "Proyecto",
    items: CONSTRUCTORA_SETUP_ITEMS,
  },
] as const;

export const getConstructoraSetupItem = (key?: string | null) =>
  CONSTRUCTORA_SETUP_ITEMS.find((item) => item.key === key);
