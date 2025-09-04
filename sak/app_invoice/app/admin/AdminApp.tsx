"use client";

import { Admin } from "@/components/admin";
import { Resource } from "ra-core";
import { dataProvider } from "@/lib/dataProvider";
import type { DataProvider } from "ra-core";

import {
  UserCreate, UserEdit, UserList, UserShow,
  ItemList, ItemCreate, ItemEdit, ItemShow,
  PaisList, PaisEdit, PaisCreate, PaisShow,
  TareaList, TareaCreate, TareaEdit, TareaShow
} from "../resources";

const AdminApp = () => (
  <Admin dataProvider={dataProvider as DataProvider}>
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
  </Admin>
);

export default AdminApp;
