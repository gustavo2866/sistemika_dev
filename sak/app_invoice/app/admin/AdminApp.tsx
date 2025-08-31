"use client";

import { Admin } from "@/components/admin";
import { Resource } from "ra-core";
import { ListGuesser } from "@/components/list-guesser";
import { EditGuesser } from "@/components/edit-guesser";
import { ShowGuesser } from "@/components/show-guesser";
import { Create } from "@/components/create";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { dataProvider } from "@/lib/dataProvider";
import type { DataProvider } from "ra-core";

// Implementación 100% estándar siguiendo el tutorial oficial react-admin:
// - Todos los guessers para que el DELETE funcione automáticamente
// - Como dice el tutorial: "The Delete button in the edit view is fully functional out of the box"
const ItemCreate = () => (
  <Create redirect="list">
    <SimpleForm>
      <TextInput source="name" required />
      <TextInput source="description" multiline />
    </SimpleForm>
  </Create>
);

const AdminApp = () => (
  <Admin dataProvider={dataProvider as DataProvider}>
    <Resource 
      name="items" 
      list={ListGuesser}
      edit={EditGuesser}
      create={ItemCreate}
      show={ShowGuesser}
    />
  </Admin>
);

export default AdminApp;
