# edit.template

Copiar como `frontend/src/app/resources/<entidad>/edit.tsx`.

```tsx
"use client";

import { Edit } from "@/components/edit";
import { Form } from "./form";

/** Wrapper para editar registros reutilizando <Form /> */
export const MyEntityEdit = () => (
  <Edit title="Editar registro">
    <Form />
  </Edit>
);
```
