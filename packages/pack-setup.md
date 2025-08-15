# Guía paso a paso para crear un nuevo package en el monorepo

Esta guía describe el procedimiento preciso para crear y configurar un nuevo package (por ejemplo, `core`) en la carpeta `packages` del monorepo. Puedes reutilizar estos pasos para cualquier package futuro.

---

## 1. Crear la carpeta base y estructura

Ejecuta en la raíz del monorepo:
```powershell
mkdir packages/core
mkdir packages/core/src
mkdir packages/core/src/components
```

## 2. Crear archivos iniciales

### `packages/core/package.json`
```json
{
  "name": "@workspace/core",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@workspace/ui": "workspace:*"
  }
}
```

### `packages/core/components.json`
Crea este archivo para compatibilidad con el CLI de shadcn/ui y para definir estilos, aliases y configuración Tailwind:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "../../packages/ui/src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "hooks": "@/hooks",
    "lib": "@/lib",
    "utils": "@workspace/ui/lib/utils",
    "ui": "@workspace/ui/components"
  }
}
```

### `packages/core/tsconfig.json`
Configura los paths para UI y para los propios componentes, y habilita imports .tsx si es necesario:
```json
{
  "extends": "@workspace/typescript-config/react-library.json",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "dist",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "paths": {
      "@workspace/ui/*": ["../../packages/ui/src/*"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `packages/core/README.md`
```markdown
# @workspace/core

Componentes de alto nivel reutilizables para todas las apps del monorepo.
```

### `packages/core/src/index.ts`
```ts
// Exporta aquí todos los componentes de alto nivel
export * from "./components/ExampleComponent";
```

### `packages/core/src/components/ExampleComponent.tsx`
```tsx
import { Button } from "@workspace/ui/components/button";

export function ExampleComponent() {
  return <Button>Componente Core</Button>;
}
```

## 2.1. Crear y configurar components.json

Crea el archivo `components.json` en la raíz del package para compatibilidad con el CLI de shadcn/ui y para definir estilos, aliases y configuración Tailwind. Ejemplo:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "../../packages/ui/src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "hooks": "@/hooks",
    "lib": "@/lib",
    "utils": "@workspace/ui/lib/utils",
    "ui": "@workspace/ui/components"
  }
}
```

## 2.2. Crear y configurar tsconfig.json

Crea el archivo `tsconfig.json` en la raíz del package. Configura los paths para UI y para los propios componentes, y habilita imports .tsx si es necesario:

```json
{
  "extends": "@workspace/typescript-config/react-library.json",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "dist",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "paths": {
      "@workspace/ui/*": ["../../packages/ui/src/*"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

> Estos archivos aseguran compatibilidad con el CLI de shadcn/ui, el uso de componentes compartidos y la integración con el resto del monorepo.

## 3. Actualizar pnpm-workspace.yaml

Agrega la ruta del nuevo package si no está incluida:
```yaml
packages:
  - "packages/*"
```

## 4. Instalar dependencias y vincular paquetes locales

Ejecuta en la raíz del monorepo:
```powershell
pnpm install
```

## 5. Usar el package en una app

Importa el componente en cualquier app:
```tsx
import { ExampleComponent } from "@workspace/core";
```

## 6. Crear y exportar un componente avanzado: CoreDialog

A continuación se muestra cómo crear un componente de diálogo reutilizable usando los elementos de shadcn/ui disponibles en el paquete UI. Este ejemplo es autocontenido y puede copiarse/adaptarse para otros componentes.

### `packages/core/src/components/CoreDialog.tsx`
```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { ReactNode } from "react";

export interface CoreDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  onAccept: () => void;
  onCancel?: () => void;
  acceptLabel?: string;
  cancelLabel?: string;
}

export function CoreDialog({
  trigger,
  title,
  description,
  onAccept,
  onCancel,
  acceptLabel = "Aceptar",
  cancelLabel = "Cancelar"
}: CoreDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button onClick={onAccept}>{acceptLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Exportar el componente en `src/index.ts`
```ts
export * from "./components/CoreDialog";
```

### Ejemplo de uso en una app
```tsx
import { CoreDialog } from "@workspace/core";

<CoreDialog
  trigger={<Button>Mostrar diálogo</Button>}
  title="Confirmar acción"
  description="¿Estás seguro que deseas continuar?"
  onAccept={() => alert("Aceptado")}
  onCancel={() => alert("Cancelado")}
/>
```

> Este patrón puede usarse para cualquier componente avanzado, siempre importando los elementos base desde UI y exportando el componente en `src/index.ts`.

## 7. Cómo utilizar el package en una app del monorepo

Para que una app pueda importar y usar los componentes del package (por ejemplo, core), sigue estos pasos:

1. **Agregar la dependencia en el package.json de la app:**
   
   Abre el archivo `apps/mi-app/package.json` y agrega la línea:
   ```json
   "@workspace/core": "workspace:*"
   ```
   en el bloque `dependencies`.

2. **Instalar y vincular el package:**
   
   Ejecuta en la raíz del monorepo:
   ```powershell
   pnpm install
   ```

3. **Importar el componente en la app:**
   
   En el archivo donde lo necesites (por ejemplo, `app/page.tsx`):
   ```tsx
   import { CoreDialog } from "@workspace/core";
   import { Button } from "@workspace/ui/components/button";

   export default function Page() {
     return (
       <CoreDialog
         trigger={<Button>Mostrar diálogo</Button>}
         title="Confirmar acción"
         description="¿Desea continuar?"
         onAccept={() => alert("Aceptado")}
         onCancel={() => alert("Cancelado")}
       />
     );
   }
   ```

4. **Asegúrate de importar los estilos globales de UI en el layout de la app:**
   
   En `app/layout.tsx`:
   ```tsx
   import "@workspace/ui/globals.css";
   // ...resto del layout...
   ```

> Con estos pasos, cualquier app del monorepo podrá utilizar los componentes del package creado siguiendo esta guía, sin necesidad de configuraciones adicionales.

---

Con estos pasos, puedes crear y reutilizar cualquier package en el monorepo siguiendo una estructura clara y escalable.
