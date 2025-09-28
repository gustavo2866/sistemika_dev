"use client";

import { Admin } from "@/components/admin";
import type { DataProvider } from "ra-core";
import { Resource } from "ra-core";
import { Users, FileText, Building2, Workflow, CreditCard, Receipt, Home } from "lucide-react";
import { dataProvider } from "@/lib/dataProvider";
import { authProvider } from "@/lib/authProvider";
import { UserList, UserCreate, UserEdit, UserShow } from "@/app/resources/users";
import { TipoComprobanteList, TipoComprobanteCreate, TipoComprobanteEdit, TipoComprobanteShow } from "@/app/resources/tipos-comprobante";
import { MetodoPagoList, MetodoPagoCreate, MetodoPagoEdit, MetodoPagoShow } from "@/app/resources/metodos-pago";
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
    </Admin>
  );
};

export default AdminApp;
