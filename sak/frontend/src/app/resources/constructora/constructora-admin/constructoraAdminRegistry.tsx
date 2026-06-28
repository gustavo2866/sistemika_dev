"use client";

import type { SetupItem } from "@/components/forms/form_order";
import {
  ProyectoCreate,
  ProyectoEdit,
  ProyectoList,
} from "@/app/resources/constructora/proyectos";
import {
  ProyectoEncargadoCreate,
  ProyectoEncargadoEdit,
  ProyectoEncargadoList,
} from "@/app/resources/constructora/proyecto-encargados";
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
    key: "proyecto-encargados",
    label: "Encargados",
    description: "Administra los contactos autorizados por proyecto.",
    resource: "proyecto-encargados",
    listComponent: ProyectoEncargadoList,
    createComponent: ProyectoEncargadoCreate,
    editComponent: ProyectoEncargadoEdit,
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
