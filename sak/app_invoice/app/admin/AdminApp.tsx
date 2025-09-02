"use client";

import { Admin } from "@/components/admin";
import { Resource } from "ra-core";
import { ShowGuesser } from "@/components/show-guesser";
import { dataProvider } from "@/lib/dataProvider";
import type { DataProvider } from "ra-core";

import { UserCreate } from "../resources/users/create";
import { UserEdit } from "../resources/users/edit";
import { UserList } from "../resources/users/list";

import { ItemList } from "../resources/item/list";
import { ItemCreate } from "../resources/item/create";
import { ItemEdit } from "../resources/item/edit";
import { ItemShow } from "../resources/item/show";

const AdminApp = () => (
  <Admin dataProvider={dataProvider as DataProvider}>
    {/* Resource para Users */}
    <Resource 
      name="users" 
      list={UserList}
      edit={UserEdit}
      create={UserCreate}
      show={ShowGuesser}
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
  </Admin>
);

export default AdminApp;
