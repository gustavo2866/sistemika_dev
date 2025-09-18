"use client";

import { Admin } from "@/components/admin";
import { Resource, CustomRoutes } from "ra-core";
import { Route } from "react-router";
import { dataProvider } from "@/lib/dataProvider";
import type { DataProvider } from "ra-core";
import { authProvider } from "@/app/admin/auth/authProvider";
import { LoginPage } from "@/app/admin/components/auth";
import FacturaTestPage from "@/app/pages/factura-test/page";

import {
  UserCreate, UserEdit, UserList, UserShow,
  ItemList, ItemCreate, ItemEdit, ItemShow,
  PaisList, PaisEdit, PaisCreate, PaisShow,
  TareaList, TareaCreate, TareaEdit, TareaShow,
  ProveedorList, ProveedorCreate, ProveedorEdit, ProveedorShow,
  TipoOperacionList, TipoOperacionCreate, TipoOperacionEdit, TipoOperacionShow,
  FacturaList, FacturaCreate, FacturaEdit, FacturaShow
} from "../resources";

const AdminApp = () => (
  <Admin 
    dataProvider={dataProvider as DataProvider}
    authProvider={authProvider}
    loginPage={LoginPage}
    title="Sistema Administrativo"
  >
    {/* Rutas personalizadas */}
    <CustomRoutes>
      <Route path="/factura-test" element={<FacturaTestPage />} />
    </CustomRoutes>

    {/* Resource para Users */}
    <Resource 
      name="users" 
      list={UserList}
      edit={UserEdit}
      create={UserCreate}
      show={UserShow}
      recordRepresentation="nombre"
    />
    
    {/* Resource para Items con relación a Users */}
    <Resource 
      name="items" 
      list={ItemList}
      edit={ItemEdit}
      create={ItemCreate}
      show={ItemShow}
    />

    {/* Resource para Paises */}
    <Resource 
      name="paises" 
      list={PaisList}
      edit={PaisEdit}
      create={PaisCreate}
      show={PaisShow}
    />

    {/* Resource para Tareas */}
    <Resource 
      name="tareas" 
      list={TareaList}
      edit={TareaEdit}
      create={TareaCreate}
      show={TareaShow}
      recordRepresentation="titulo"
    />

    {/* Resource para Proveedores */}
    <Resource 
      name="proveedores" 
      list={ProveedorList}
      edit={ProveedorEdit}
      create={ProveedorCreate}
      show={ProveedorShow}
      recordRepresentation="nombre"
    />

    {/* Resource para Tipos de Operación */}
    <Resource 
      name="tipos-operacion" 
      list={TipoOperacionList}
      edit={TipoOperacionEdit}
      create={TipoOperacionCreate}
      show={TipoOperacionShow}
      recordRepresentation="descripcion"
    />

    {/* Resource para Facturas */}
    <Resource 
      name="facturas" 
      list={FacturaList}
      edit={FacturaEdit}
      create={FacturaCreate}
      show={FacturaShow}
      recordRepresentation="numero"
    />
  </Admin>
);

export default AdminApp;
