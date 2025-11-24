# create.template

Copiar como `frontend/src/app/resources/<entidad>/create.tsx`.

```tsx
"use client";

import { Create } from "@/components/create";
import { Form } from "./form";

/** Wrapper para crear registros reutilizando <Form /> */
export const MyEntityCreate = () => (
  <Create redirect="list" title="Nuevo registro">
    <Form />
  </Create>
);
```
