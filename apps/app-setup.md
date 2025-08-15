# Guía paso a paso para crear una nueva app en el monorepo

Esta guía describe todos los pasos necesarios para crear y configurar una nueva aplicación (por ejemplo, `app1`) en el monorepo. Sigue cada paso exactamente para asegurar el funcionamiento correcto.

---

## 1. Crear la carpeta base y estructura

Ejecuta en la raíz del monorepo:
```powershell
mkdir apps/app1
mkdir apps/app1/app
mkdir apps/app1/components
mkdir apps/app1/hooks
mkdir apps/app1/lib
```

## 2. Crear archivos iniciales

### `apps/app1/package.json`
```json
{
  "name": "@workspace/app1",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest"
  }
}
```

### `apps/app1/tsconfig.json`
```json
{
  "extends": "@workspace/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@workspace/ui/*": ["../../packages/ui/src/*"]
    },
    "outDir": "build"
  },
  "include": [
    "next-env.d.ts",
    "next.config.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

### `apps/app1/next.config.mjs`
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
}

export default nextConfig
```

### `apps/app1/postcss.config.mjs`
```js
export { default } from "../../packages/ui/postcss.config.mjs";
```

### `apps/app1/components.json`
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

### `apps/app1/next-env.d.ts`
```ts
/// <reference types="next" />
```

### `apps/app1/tailwind.config.js`
Crea este archivo en cada nueva app para extender el preset centralizado de UI:

```js
const preset = require('../../packages/ui/tailwind.preset.js');

module.exports = {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/**/*.{ts,tsx}',
  ],
  // Puedes extender aquí la configuración para la app
};
```

Esto asegura que la app herede todas las utilidades, variantes y plugins definidos en el preset de UI, y permite personalizaciones locales si lo necesitas.

## 3. Crear archivos de página y layout

### `apps/app1/app/layout.tsx`
```tsx
import "@workspace/ui/globals.css";

export const metadata = {
  title: 'app1',
  description: 'App1 - Monorepo',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
```

### `apps/app1/app/page.tsx`
```tsx
import { Button } from "@workspace/ui/components/button";
import type { FC } from "react";

const Page: FC = () => {
  return (
    <div className="flex items-center justify-center min-h-svh">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">¡Bienvenido a app1!</h1>
        <Button size="sm">Botón UI</Button>
      </div>
    </div>
  );
}

export default Page;
```

## 4. Instalar dependencias y vincular paquetes locales

Ejecuta en la raíz del monorepo:
```powershell
pnpm install
```

Si usas TurboRepo, revisa y agrega la nueva app en `turbo.json` si es necesario.

## 5. Notas y recomendaciones
- Verifica que `@workspace/ui` esté correctamente definido en `packages/ui/package.json`.
- Asegúrate de que la ruta `packages/*` esté incluida en `pnpm-workspace.yaml`.
- Si aparecen errores de importación de paquetes locales, usa rutas relativas en archivos de configuración (`postcss.config.mjs`, etc.).
- Si usas TypeScript, asegúrate de instalar los tipos necesarios:
  ```powershell
  pnpm add -Dw @types/react @types/react-dom
  ```
- Si usas fuentes o providers globales, agrégalos en el layout como en `web`.
- Documenta cada paso y cambio realizado para futuras referencias.

---

Con estos pasos, la nueva app funcionará igual que `web` y tendrá acceso a los componentes y estilos globales del monorepo.

---

## Ejemplo de personalización de color por app usando variables CSS

Para personalizar el color de los botones (o cualquier componente shadcn/ui) en una app específica, sobreescribe la variable CSS correspondiente en el layout de la app. Por ejemplo, para que el botón sea rojo en app2:

```tsx
// apps/app2/app/layout.tsx
import "@workspace/ui/globals.css";

export const metadata = {
  title: 'app2',
  description: 'App2 - Monorepo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ ['--primary' as any]: 'oklch(0.6 0.2 30)' }}>{children}</body>
    </html>
  );
}
```

Esto hará que el botón y cualquier componente que use la variable `--primary` se muestre en rojo solo en esa app.

---

## Nota importante sobre personalización de colores en shadcn/ui

Aunque el preset de Tailwind centraliza las utilidades y clases, los componentes shadcn/ui dependen de las variables CSS para su apariencia final. Por eso, la forma efectiva de personalizar colores (por ejemplo, el color del botón) en una app es sobreescribir la variable CSS correspondiente en el layout o en un archivo CSS adicional:

```tsx
// apps/app2/app/layout.tsx
import "@workspace/ui/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ ['--primary' as any]: 'oklch(0.6 0.2 30)' }}>{children}</body>
    </html>
  );
}
```

Esto asegura que los componentes tomen el color personalizado, independientemente de la configuración de Tailwind.

---

## Uso del preset Tailwind en una app

Para que una app utilice el preset centralizado de Tailwind, crea el archivo `tailwind.config.js` en la raíz de la app con el siguiente contenido:

```js
const preset = require('../../packages/ui/tailwind.preset.js');

module.exports = {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/**/*.{ts,tsx}',
  ],
};
```

Esto asegura que la app2 (o cualquier otra) tenga acceso a todas las utilidades, colores y extensiones definidas en el preset del paquete UI.

---

## Registro de pasos realizados para app2

### 15/08/2025
- Se crearon las carpetas:
  - `apps/app2/app/`
  - `apps/app2/components/`
  - `apps/app2/hooks/`
  - `apps/app2/lib/`
- Se agregaron los archivos iniciales:
  - `apps/app2/package.json`
  - `apps/app2/tsconfig.json`
  - `apps/app2/next.config.mjs`
  - `apps/app2/postcss.config.mjs`
  - `apps/app2/components.json`
  - `apps/app2/next-env.d.ts`
  - `apps/app2/tailwind.config.js`
- Se creó la página inicial:
  - `apps/app2/app/page.tsx`
- Se creó el layout raíz:
  - `apps/app2/app/layout.tsx`

Todos los pasos se realizaron siguiendo la guía y la app2 está lista para instalar dependencias y ejecutarse.
