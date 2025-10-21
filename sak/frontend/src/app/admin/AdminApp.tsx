"use client";

import { Admin } from "@/components/admin";
import type { DataProvider } from "ra-core";
import { Resource } from "ra-core";
import { Users, FileText, Building2, Workflow, CreditCard, Receipt, Home, Package, ClipboardList, Kanban, Truck, BarChart3, ShoppingCart, ClipboardCheck, Wallet, NotebookPen } from "lucide-react";
import { dataProvider } from "@/lib/dataProvider";
import { authProvider } from "@/lib/authProvider";
import { UserList, UserCreate, UserEdit, UserShow } from "@/app/resources/users";
import { TipoComprobanteList, TipoComprobanteCreate, TipoComprobanteEdit, TipoComprobanteShow } from "@/app/resources/tipos-comprobante";
import { MetodoPagoList, MetodoPagoCreate, MetodoPagoEdit, MetodoPagoShow } from "@/app/resources/metodos-pago";
import { ArticuloList, ArticuloCreate, ArticuloEdit, ArticuloShow } from "@/app/resources/articulos";
import { PropiedadList, PropiedadCreate, PropiedadEdit, PropiedadShow } from "@/app/resources/propiedades";
import {
  FacturaList,
  FacturaCreate,
  FacturaEdit,
  FacturaShow,
} from "@/app/resources/facturas";
import {
  ProveedorList,
  ProveedorCreate,
  ProveedorEdit,
  ProveedorShow,
} from "@/app/resources/proveedores";
import {
  TipoOperacionList,
  TipoOperacionCreate,
  TipoOperacionEdit,
  TipoOperacionShow,
} from "@/app/resources/tipos-operacion";
import {
  ProyectoList,
  ProyectoCreate,
  ProyectoEdit,
  ProyectoShow,
} from "@/app/resources/proyectos";
import {
  SolicitudMbList,
  SolicitudMbCreate,
  SolicitudMbEdit,
} from "@/app/resources/solicitudes_mb";
import RecepcionesList from "@/app/resources/recepciones/list";
import DashboardProyectosList from "@/app/resources/dashboard-proyectos/list";
import OrdenCompraList from "@/app/resources/orden-compra/list";
import TarjasList from "@/app/resources/tarjas/list";
import {
  NominaList,
  NominaCreate,
  NominaEdit,
  NominaShow,
} from "@/app/resources/nomina";
import {
  ParteDiarioList,
  ParteDiarioCreate,
  ParteDiarioEdit,
  ParteDiarioShow,
} from "@/app/resources/parte-diario";

declare const window: Window | undefined;

const AdminApp = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    <Admin
      requireAuth
      dataProvider={dataProvider as DataProvider}
      authProvider={authProvider}
      title="Admin Panel"
    >
      <Resource
        name="users"
        list={UserList}
        create={UserCreate}
        edit={UserEdit}
        show={UserShow}
        recordRepresentation="nombre"
        icon={Users}
      />
      <Resource
        name="tipos-comprobante"
        list={TipoComprobanteList}
        create={TipoComprobanteCreate}
        edit={TipoComprobanteEdit}
        show={TipoComprobanteShow}
        recordRepresentation="name"
        icon={Receipt}
      />
      <Resource
        name="facturas"
        list={FacturaList}
        create={FacturaCreate}
        edit={FacturaEdit}
        show={FacturaShow}
        recordRepresentation="numero"
        icon={FileText}
      />
      <Resource
        name="proveedores"
        list={ProveedorList}
        create={ProveedorCreate}
        edit={ProveedorEdit}
        show={ProveedorShow}
        recordRepresentation="nombre"
        icon={Building2}
      />
      <Resource
        name="metodos-pago"
        list={MetodoPagoList}
        create={MetodoPagoCreate}
        edit={MetodoPagoEdit}
        show={MetodoPagoShow}
        recordRepresentation="nombre"
        icon={CreditCard}
      />
      <Resource
        name="proyectos"
        list={ProyectoList}
        create={ProyectoCreate}
        edit={ProyectoEdit}
        show={ProyectoShow}
        recordRepresentation="nombre"
        icon={Kanban}
        options={{ label: "Proyectos" }}
      />
      <Resource
        name="articulos"
        list={ArticuloList}
        create={ArticuloCreate}
        edit={ArticuloEdit}
        show={ArticuloShow}
        recordRepresentation="nombre"
        icon={Package}
      />
      <Resource
        name="propiedades"
        list={PropiedadList}
        create={PropiedadCreate}
        edit={PropiedadEdit}
        show={PropiedadShow}
        recordRepresentation="nombre"
        icon={Home}
      />
      <Resource
        name="tipos-operacion"
        list={TipoOperacionList}
        create={TipoOperacionCreate}
        edit={TipoOperacionEdit}
        show={TipoOperacionShow}
        recordRepresentation="descripcion"
        icon={Workflow}
      />
      <Resource
        name="solicitudes"
        list={SolicitudMbList}
        create={SolicitudMbCreate}
        edit={SolicitudMbEdit}
        recordRepresentation="tipo"
        icon={ClipboardList}
        options={{ label: "Solicitudes MB" }}
      />
      <Resource
        name="recepciones"
        list={RecepcionesList}
        recordRepresentation="id"
        icon={Truck}
        options={{ label: "Recepciones" }}
      />
      <Resource
        name="dashboard-proyectos"
        list={DashboardProyectosList}
        recordRepresentation="id"
        icon={BarChart3}
        options={{ label: "Dashboard" }}
      />
      <Resource
        name="orden-compra"
        list={OrdenCompraList}
        recordRepresentation="id"
        icon={ShoppingCart}
        options={{ label: "Orden de Compra" }}
      />
      <Resource
        name="tarjas"
        list={TarjasList}
        recordRepresentation="id"
        icon={ClipboardCheck}
        options={{ label: "Tarjas" }}
      />
      <Resource
        name="parte-diario"
        list={ParteDiarioList}
        create={ParteDiarioCreate}
        edit={ParteDiarioEdit}
        show={ParteDiarioShow}
        recordRepresentation="descripcion"
        icon={NotebookPen}
        options={{ label: "Parte Diario" }}
      />
      <Resource
        name="nominas"
        list={NominaList}
        create={NominaCreate}
        edit={NominaEdit}
        show={NominaShow}
        recordRepresentation="nombre"
        icon={Wallet}
        options={{ label: "Nómina" }}
      />
    </Admin>
  );
};

export default AdminApp;

