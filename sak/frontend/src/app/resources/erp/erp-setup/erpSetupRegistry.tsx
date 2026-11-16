"use client";

import type { SetupItem } from "@/components/forms/form_order";
import { ErpRubroCreate, ErpRubroEdit, ErpRubroList } from "../rubros";
import { ErpCuentaCreate, ErpCuentaEdit, ErpCuentaList } from "../cuentas";
import {
  ErpCuentaTipoCreate,
  ErpCuentaTipoEdit,
  ErpCuentaTipoList,
} from "../cuenta-tipos";


export const ERP_SETUP_ITEMS: SetupItem[] = [
  {
    key: "rubros",
    label: "Rubros",
    description: "Administrar los rubros utilizados para clasificar cuentas ERP.",
    resource: "erp/rubros",
    listComponent: ErpRubroList,
    createComponent: ErpRubroCreate,
    editComponent: ErpRubroEdit,
  },
  {
    key: "cuentas",
    label: "Cuentas",
    description: "Administrar el plan de cuentas ERP.",
    resource: "erp/cuentas",
    listComponent: ErpCuentaList,
    createComponent: ErpCuentaCreate,
    editComponent: ErpCuentaEdit,
  },
  {
    key: "cuenta-tipos",
    label: "Tipos de cuenta",
    description: "Administrar los tipos y códigos de cuenta ERP.",
    resource: "erp/cuenta-tipos",
    listComponent: ErpCuentaTipoList,
    createComponent: ErpCuentaTipoCreate,
    editComponent: ErpCuentaTipoEdit,
  },
];

export const getErpSetupItem = (key?: string | null) =>
  ERP_SETUP_ITEMS.find((item) => item.key === key);
