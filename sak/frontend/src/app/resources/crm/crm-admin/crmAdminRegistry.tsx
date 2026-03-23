"use client";

import type { SetupItem } from "@/components/forms/form_order";
import {
  CRMCelularCreate,
  CRMCelularEdit,
  CRMCelularList,
} from "@/app/resources/crm/crm-celulares";
import {
  CRMContactoCreate,
  CRMContactoEdit,
  CRMContactoList,
} from "@/app/resources/crm/crm-contactos";
import {
  CRMMensajeCreate,
  CRMMensajeEdit,
  CRMMensajeList,
} from "@/app/resources/crm/crm-mensajes";

export const CRM_ADMIN_ITEMS: SetupItem[] = [
  {
    key: "celulares",
    label: "Celulares",
    description: "Lineas y canales moviles integrados al modulo CRM.",
    resource: "crm/celulares",
    listComponent: CRMCelularList,
    createComponent: CRMCelularCreate,
    editComponent: CRMCelularEdit,
  },
  {
    key: "contactos",
    label: "Contactos",
    description: "Agenda comercial y responsables del equipo CRM.",
    resource: "crm/contactos",
    listComponent: CRMContactoList,
    createComponent: CRMContactoCreate,
    editComponent: CRMContactoEdit,
  },
  {
    key: "mensajes",
    label: "Mensajes",
    description: "Administracion de mensajes y seguimiento comercial.",
    resource: "crm/mensajes",
    listComponent: CRMMensajeList,
    createComponent: CRMMensajeCreate,
    editComponent: CRMMensajeEdit,
  },
];

export const getCRMAdminItem = (key?: string | null) =>
  CRM_ADMIN_ITEMS.find((item) => item.key === key);
