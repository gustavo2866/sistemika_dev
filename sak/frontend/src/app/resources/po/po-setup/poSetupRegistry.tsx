"use client";

import type { SetupItem } from "@/components/forms/form_order";
import {
  ArticuloCreate,
  ArticuloEdit,
  ArticuloList,
} from "@/app/resources/po/articulos";
import {
  TipoArticuloCreate,
  TipoArticuloEdit,
  TipoArticuloList,
} from "@/app/resources/po/tipos-articulo";
import {
  TipoSolicitudCreate,
  TipoSolicitudEdit,
  TipoSolicitudList,
} from "@/app/resources/configuracion/tipos-solicitud";
import {
  PoOrderStatusCreate,
  PoOrderStatusEdit,
  PoOrderStatusList,
} from "@/app/resources/po/po-order-status";
import {
  PoInvoiceStatusCreate,
  PoInvoiceStatusEdit,
  PoInvoiceStatusList,
} from "@/app/resources/po/po-invoice-status";
import {
  PoInvoiceStatusFinCreate,
  PoInvoiceStatusFinEdit,
  PoInvoiceStatusFinList,
} from "@/app/resources/po/po-invoice-status-fin";
import {
  DepartamentoCreate,
  DepartamentoEdit,
  DepartamentoList,
} from "@/app/resources/po/departamentos";

export const PO_SETUP_ITEMS: SetupItem[] = [
  {
    key: "articulos",
    label: "Articulos",
    description: "Gestion de articulos para compras.",
    resource: "articulos",
    listComponent: ArticuloList,
    createComponent: ArticuloCreate,
    editComponent: ArticuloEdit,
  },
  {
    key: "tipos-articulo",
    label: "Tipos de articulo",
    description: "Configurar tipos de articulo para compras.",
    resource: "tipos-articulo",
    listComponent: TipoArticuloList,
    createComponent: TipoArticuloCreate,
    editComponent: TipoArticuloEdit,
  },
  {
    key: "tipos-solicitud",
    label: "Tipos de solicitud",
    description: "Configurar tipos de solicitud de compras.",
    resource: "tipos-solicitud",
    listComponent: TipoSolicitudList,
    createComponent: TipoSolicitudCreate,
    editComponent: TipoSolicitudEdit,
  },
  {
    key: "estados-orden",
    label: "Estados de orden",
    description: "Configurar estados de orden de compra.",
    resource: "po-order-status",
    listComponent: PoOrderStatusList,
    createComponent: PoOrderStatusCreate,
    editComponent: PoOrderStatusEdit,
  },
  {
    key: "estados-factura",
    label: "Estados de factura",
    description: "Configurar estados de factura de compra.",
    resource: "po-invoice-status",
    listComponent: PoInvoiceStatusList,
    createComponent: PoInvoiceStatusCreate,
    editComponent: PoInvoiceStatusEdit,
  },
  {
    key: "estados-financieros-factura",
    label: "Estados financieros factura",
    description: "Configurar estados financieros de factura de compra.",
    resource: "po-invoice-status-fin",
    listComponent: PoInvoiceStatusFinList,
    createComponent: PoInvoiceStatusFinCreate,
    editComponent: PoInvoiceStatusFinEdit,
  },
  {
    key: "departamentos",
    label: "Departamentos",
    description: "Administrar departamentos para imputacion.",
    resource: "departamentos",
    listComponent: DepartamentoList,
    createComponent: DepartamentoCreate,
    editComponent: DepartamentoEdit,
  },
];

export const getPOSetupItem = (key?: string | null) =>
  PO_SETUP_ITEMS.find((item) => item.key === key);
