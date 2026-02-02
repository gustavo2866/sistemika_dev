# Arquitectura CRUD - PoSolicitudes (Cabecera/Detalle)

- Patron Cabecera/Detalle (Resumen) (LOC: N/A)
  - Objetivo: Separar UI cabecera vs detalle.
  - Descripcion: El form principal mantiene el registro completo. El detalle se edita en un sub-form interno. Se duplica `detalles` temporalmente y luego se sincroniza al form principal.

- List.tsx (LOC: 553)
  - Objetivo: Listado con filtros y contexto CRM.
  - Descripcion: `List` con filtros declarativos. Defaults y sincronizacion de `oportunidad_id` desde la URL.

- list_header_crm.tsx (LOC: 154)
  - Objetivo: Header contextual desde CRM.
  - Descripcion: Encabezado que muestra contexto (oportunidad) segun parametros de navegacion.

- create.tsx (LOC: 106)
  - Objetivo: Crear con wizard opcional.
  - Descripcion: Abre create y dispara wizard si hay query. Normaliza payload antes de guardar.

- edit.tsx (LOC: 58)
  - Objetivo: Editar registro.
  - Descripcion: Form de edicion con la misma normalizacion que create.

- show.tsx (LOC: 386)
  - Objetivo: Vista read-only.
  - Descripcion: Vista de solo lectura con formatos consistentes.

- form.tsx (LOC: 799)
  - Objetivo: Orquestar cabecera + detalle.
  - Descripcion: Define layout, secciones y subtitulos. Delega detalle a `FormDetailSection`.

- form_detalle.tsx (LOC: 414)
  - Objetivo: UI de items del detalle.
  - Descripcion: Sub-form de detalle que edita items. Sincroniza el array `detalles` con el form principal.

- form_hooks.ts (LOC: 557)
  - Objetivo: Logica reactiva reutilizable.
  - Descripcion: Hooks de defaults, subtitulos, calculos y catalogos. Reduce `useEffect` en el form.

- wizard_create.tsx (LOC: 492)
  - Objetivo: Asistente de carga rapida.
  - Descripcion: Wizard multipaso que arma payload inicial y crea el registro.

- model.ts (LOC: 797)
  - Objetivo: Dominio y schemas.
  - Descripcion: Tipos, reglas, schemas, helpers y normalizacion de datos.

- index.ts (LOC: 5)
  - Objetivo: Registrar el recurso.
  - Descripcion: Exporta el resource para `AdminApp`.

- README.md (LOC: 41)
  - Objetivo: Documentar el recurso.
  - Descripcion: Resumen funcional y puntos de integracion.

- form_readme.md (LOC: 80)
  - Objetivo: Documentar la arquitectura.
  - Descripcion: Explica cabecera/detalle y sincronizacion de `detalles`.
