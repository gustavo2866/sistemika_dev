# Meta WhatsApp API - Frontend

Frontend de la aplicación de gestión de mensajes de WhatsApp con Next.js y shadcn/ui.

## Tecnologías

- **Next.js 15** con App Router
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** - Componentes UI
- **Zustand** - State management
- **React Hook Form + Zod** - Formularios y validación
- **TanStack Table** - Data tables
- **Axios** - Cliente HTTP

## Instalación

1. Instalar dependencias:
```powershell
npm install
```

2. Configurar variables de entorno:
```powershell
cp .env.local.example .env.local
# Editar .env.local con la URL del backend
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Build para Producción

```powershell
npm run build
npm run start
```

## Estructura

- `src/app/` - App Router (rutas y páginas)
- `src/components/` - Componentes React
  - `ui/` - Componentes shadcn/ui
  - `layout/` - Componentes de layout
  - `features/` - Componentes de funcionalidades (CRUDs)
- `src/lib/` - Utilidades y configuración
- `src/services/` - Servicios de API
- `src/hooks/` - Custom hooks
- `src/store/` - State management
- `src/types/` - Tipos TypeScript

## shadcn/ui Admin Kit

Este proyecto utiliza patrones de shadcn admin kit para los CRUDs:
- Data tables con paginación y filtros
- Formularios con validación
- Dialogs y acciones
- Layout con sidebar responsive

Referencia: https://github.com/salimi-my/shadcn-ui-sidebar

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
