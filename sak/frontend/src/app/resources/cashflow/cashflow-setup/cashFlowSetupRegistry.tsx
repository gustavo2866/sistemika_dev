"use client";

import type { SetupItem } from "@/components/forms/form_order";
import { ErpCashCuentaCreate, ErpCashCuentaEdit, ErpCashCuentaList } from "../cuentas";
import {
  ErpCashProyectadoCreate,
  ErpCashProyectadoEdit,
  ErpCashProyectadoList,
} from "../proyectado";
import {
  ErpCashPeriodoCreate,
  ErpCashPeriodoEdit,
  ErpCashPeriodoList,
} from "../periodos";
import { ErpCashSubctaCreate, ErpCashSubctaEdit, ErpCashSubctaList } from "../subctas";
import { ErpCashMapCreate, ErpCashMapEdit, ErpCashMapList } from "../maps";

export const CASHFLOW_SETUP_ITEMS: SetupItem[] = [
  {
    key: "cuentas",
    label: "Cuentas Cash",
    description: "Administrar los conceptos utilizados en los mapeos de debe y haber.",
    resource: "erp/cash/cuentas",
    listComponent: ErpCashCuentaList,
    createComponent: ErpCashCuentaCreate,
    editComponent: ErpCashCuentaEdit,
  },
  {
    key: "proyectado",
    label: "Proyectado Cash",
    description: "Administrar importes mensuales proyectados por cuenta financiera y tipo.",
    resource: "erp/cash/proyectado",
    listComponent: ErpCashProyectadoList,
    createComponent: ErpCashProyectadoCreate,
    editComponent: ErpCashProyectadoEdit,
  },
  {
    key: "periodos",
    label: "Períodos Cash",
    description: "Administrar la apertura y el cierre mensual del CashFlow.",
    resource: "erp/cash/periodos",
    listComponent: ErpCashPeriodoList,
    createComponent: ErpCashPeriodoCreate,
    editComponent: ErpCashPeriodoEdit,
  },
  {
    key: "subctas",
    label: "Subcuentas Cash",
    description: "Administrar las subcuentas y categorías del flujo de fondos.",
    resource: "erp/cash/subctas",
    listComponent: ErpCashSubctaList,
    createComponent: ErpCashSubctaCreate,
    editComponent: ErpCashSubctaEdit,
  },
  {
    key: "mapas",
    label: "Mapeo Cash",
    description: "Relacionar cuentas ERP con conceptos Cash para debe y haber.",
    resource: "erp/cash/maps",
    listComponent: ErpCashMapList,
    createComponent: ErpCashMapCreate,
    editComponent: ErpCashMapEdit,
  },
];

export const getCashFlowSetupItem = (key?: string | null) =>
  CASHFLOW_SETUP_ITEMS.find((item) => item.key === key);
