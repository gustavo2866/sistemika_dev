# Patron del resource `crm-mensajes`

Este resource sigue el patron CRUD del proyecto, pero con una extension
controlada para cubrir necesidades operativas del modulo CRM.

La idea es distinguir con claridad:

- que pertenece al CRUD base del patron;
- que pertenece a extensiones validas del resource;
- que no deberia mezclarse con el esqueleto principal.

## Niveles del patron

### Nivel 1: CRUD simple

Es el patron base que usan los catalogos y resources CRUD mas directos.

Incluye:

- `model.ts`
- `form.tsx`
- `create.tsx`
- `edit.tsx`
- `show.tsx`
- `list.tsx`
- `index.ts`

En `list.tsx`, el esqueleto esperado del Nivel 1 es:

- `buildListFilters(...)`
- `List`
- `actions`
- `ResponsiveDataTable`
- `ListPaginator`

Eso define el patron simple.

### Nivel 2: CRUD con dashboard de filtros

Cuando el listado necesita una capa extra de navegacion o filtros visuales,
se agrega un componente local del resource llamado `list_dashboard.tsx`.

Ese archivo:

- vive dentro del mismo resource;
- contiene la UI y la logica de negocio de buckets/cards;
- se monta desde `list.tsx` usando `topContent`;
- no reemplaza el patron CRUD base, solo lo extiende.

En `crm-mensajes`, `list_dashboard.tsx` se considera el unico elemento
estructural de Nivel 2 del listado.

## Regla principal para `crm-mensajes`

`list.tsx` debe verse, en lo posible, casi igual a un CRUD simple.

La diferencia aceptada es:

- `topContent={<CRMMensajesListDashboard />}`

Todo lo demas que no sea parte del esqueleto CRUD debe quedar marcado como
"fuera del patron" y mantenerse aislado por secciones.

## Estructura actual del resource

- `model.ts`: dominio, tipos, schemas, defaults y helpers visuales.
- `list.tsx`: composicion principal del listado.
- `list_dashboard.tsx`: patron Nivel 2 para buckets y filtros superiores.
- `form.tsx`: formulario base del mensaje.
- `form_mensaje.tsx`: flujo especial para alta de mensajes salientes.
- `form_responder.tsx`: dialogo operativo para responder mensajes.
- `create.tsx`: wrapper de alta.
- `edit.tsx`: wrapper de edicion.
- `show.tsx`: detalle operativo del mensaje.
- `index.ts`: exports explicitos.

## Responsabilidad de cada archivo

### `model.ts`

Debe contener:

- tipos del dominio;
- `zod` schemas;
- defaults;
- normalizadores;
- choices;
- helpers de labels y badges.

No debe contener logica de UI del listado.

### `list.tsx`

Debe contener el esqueleto CRUD del listado.

Puede contener extensiones del resource, pero separadas y marcadas por region:

- `Base CRUD: configuracion del listado`
- `Fuera del patron: helpers de presentacion enriquecida`
- `Fuera del patron: celdas enriquecidas del listado`
- `Fuera del patron: acciones operativas y contexto`
- `Base CRUD: componentes principales`

La lectura ideal del archivo debe permitir ver rapido:

1. cual es la base del patron;
2. cuales son las excepciones propias de `crm-mensajes`.

### `list_dashboard.tsx`

Es el patron Nivel 2 del listado.

Su responsabilidad es:

- leer `filterValues` del listado;
- resolver buckets y subfiltros activos;
- calcular contadores;
- aplicar `setFilters(...)`;
- renderizar las cards del dashboard.

No debe contener columnas, acciones de fila ni dialogos del listado.

### `form.tsx`

Debe seguir el patron de formularios del proyecto usando:

- `SimpleForm`
- `zodResolver(...)`
- `FormOrderToolbar`
- `SectionBaseTemplate`
- wrappers de `form_order`

### `form_mensaje.tsx`

Es una excepcion operativa valida.

Su responsabilidad es:

- validar datos de envio;
- normalizar payload;
- llamar al endpoint `/crm/mensajes/acciones/enviar`;
- mantener el mismo lenguaje visual del patron.

### `form_responder.tsx`

Es un subflujo operativo.

Debe encapsular:

- UI del dialogo de respuesta;
- validacion del flujo de respuesta;
- llamada al endpoint operativo correspondiente.

### `show.tsx`

Debe respetar el patron visual del CRUD, pero admitiendo acciones operativas.

Puede incluir:

- responder;
- descartar;
- navegacion contextual;

siempre que esas acciones no desordenen la estructura principal.

## Que se considera fuera del patron en `list.tsx`

Estas piezas son validas, pero no pertenecen al patron simple:

- `MensajeContextBanner`
- `FechaCell`
- `TipoCell`
- `ContactoCell`
- `AsuntoCell`
- `EstadoCell`
- items operativos del menu de acciones

No son un problema, pero deben quedar claramente agrupadas como extensiones del
resource.

## Componentes reutilizables y ubicacion

Regla vigente del proyecto:

- componentes base de `shadcn admin kit` y wrappers de `frontend/src/components`
  no se mueven;
- componentes de `shadcn/ui` no se mueven;
- componentes custom reutilizables del sistema deben vivir en
  `frontend/src/components/forms/form_order`.

Aplicacion practica en este resource:

- `DashboardCard` es reusable y pertenece a `form_order`;
- `CRMMensajesListDashboard` no es generico y debe vivir dentro del resource;
- celdas y acciones de `crm-mensajes` siguen locales mientras no exista una
  repeticion real en otros resources.

## Regla practica final

Si el problema es CRUD puro, usar Patron Nivel 1.

Si el problema necesita dashboard de filtros o navegacion superior propia del
listado, usar Patron Nivel 2:

- mantener `list.tsx` lo mas cercano posible al CRUD base;
- aislar la logica del dashboard en `list_dashboard.tsx`;
- marcar explicitamente todo lo que quede fuera del patron simple.
