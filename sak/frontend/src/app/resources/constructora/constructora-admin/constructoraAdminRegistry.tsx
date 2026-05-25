"use client";

import type { SetupItem } from "@/components/forms/form_order";
import {
  ProyectoCreate,
  ProyectoEdit,
  ProyectoList,
} from "@/app/resources/constructora/proyectos";
import {
  NominaCreate,
  NominaEdit,
  NominaList,
} from "@/app/resources/administracion/nomina";

export const CONSTRUCTORA_ADMIN_ITEMS: SetupItem[] = [
  {
    key: "proyectos",
    label: "Proyectos",
    description: "Administra proyectos y datos maestros asociados.",
    resource: "proyectos",
    listComponent: ProyectoList,
    createComponent: ProyectoCreate,
    editComponent: ProyectoEdit,
  },
  {
    key: "nominas",
    label: "Nomina",
    description: "Administra empleados y asignaciones a proyectos.",
    resource: "nominas",
    listComponent: NominaList,
    createComponent: NominaCreate,
    editComponent: NominaEdit,
  },
];

export const getConstructoraAdminItem = (key?: string | null) =>
  CONSTRUCTORA_ADMIN_ITEMS.find((item) => item.key === key);
