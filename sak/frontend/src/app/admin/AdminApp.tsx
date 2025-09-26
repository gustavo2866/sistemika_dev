"use client";

import { Admin } from "@/components/admin";
import { Resource } from "ra-core";
import type { DataProvider } from "ra-core";
import { dataProvider } from "@/lib/dataProvider";
import { authProvider } from "@/lib/authProvider";
import { UserList, UserCreate, UserEdit, UserShow } from "@/app/resources/users";

declare const window: Window | undefined;

const AdminApp = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    <Admin
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
      />
    </Admin>
  );
};

export default AdminApp;
