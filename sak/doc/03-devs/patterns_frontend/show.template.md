# show.template

Copiar como `frontend/src/app/resources/<entidad>/show.tsx` cuando se requiera una vista de solo lectura.

```tsx
"use client";

import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";

export const MyEntityShow = () => (
  <Show title="Detalle del registro">
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="text-sm text-muted-foreground">Nombre</p>
        <TextField source="nombre" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Responsable</p>
        <ReferenceField source="responsable_id" reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </div>
    </div>
  </Show>
);
```
