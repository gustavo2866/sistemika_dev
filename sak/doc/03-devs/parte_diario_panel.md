# parteDiarioPanel

Especificacion para una vista semanal de partes diarios por obra.

## Objetivo

Crear `ParteDiarioPanel`, una vista operativa alternativa a `ParteDiarioList`, orientada a revisar rapidamente que obras generaron parte diario en una semana y cuales siguen sin reportar.

La vista debe funcionar como un calendario semanal:

- Una columna por dia.
- En cada columna, tarjetas para los partes diarios existentes.
- En cada columna, una seccion secundaria para obras activas que aun no reportaron parte ese dia.
- Navegacion por semana.
- Acceso rapido a editar un parte existente o crear uno nuevo prellenado.

## Alcance

Incluye:

- Nuevo componente frontend `ParteDiarioPanel`.
- Render semanal desde lunes a domingo.
- Filtros principales: proyecto, estado y busqueda.
- Identificador visual de color estable por obra.
- Acciones de navegacion: semana anterior, semana siguiente, hoy y selector de dia.
- Click en tarjeta existente para editar parte.
- Click en obra sin reportar para crear parte con `idproyecto` y `fecha`.

No incluye en primera version:

- Drag and drop entre dias.
- Vista mensual.
- Reglas avanzadas de feriados.
- Confirmacion masiva de partes.
- Edicion inline dentro del panel.

## Ubicacion propuesta

Frontend:

- `frontend/src/app/resources/constructora/parte-diario/panel.tsx`
- Exportar desde `frontend/src/app/resources/constructora/parte-diario/index.ts`

Opcional:

- Agregar ruta `/parte-diario/panel`.
- Agregar toggle de vista `Lista / Semana` en la pantalla de partes diarios.

## Relacion con `ParteDiarioList`

`ParteDiarioPanel` no deberia reemplazar a `ParteDiarioList`.

`ParteDiarioList` sigue siendo la vista tabular para busqueda, exportacion y revision historica.

`ParteDiarioPanel` queda como vista semanal operativa para control diario de reporte por obra.

Se recomienda reutilizar:

- `estadoParteChoices`
- `getEstadoParteLabel`
- `getEstadoParteBadgeClass`
- filtros equivalentes a proyecto, estado y `q`
- navegacion a `edit`

## Layout general

La pantalla debe mantener la estetica actual del sistema:

- Contenedor ancho tipo `LIST_CONTAINER_WIDE`.
- Fondo blanco.
- Bordes `border-slate-200`.
- `rounded-lg`.
- Sombra suave `shadow-[0_10px_30px_rgba(15,23,42,0.06)]`.
- Tipografia compacta entre `text-[10px]` y `text-[12px]`.
- Botones chicos y densos.

Estructura:

```txt
Header
  Volver / titulo / acciones

Toolbar
  Semana anterior | rango semanal | selector de dia | Semana siguiente | Hoy | filtros | Crear

Panel semanal
  Lun 17/06 | Mar 18/06 | Mie 19/06 | Jue 20/06 | Vie 21/06 | Sab 22/06 | Dom 23/06
```

## Columna de dia

Cada columna representa una fecha.

Debe tener:

- Header con nombre corto del dia y fecha.
- Estado visual especial para hoy.
- Seccion principal: partes existentes.
- Seccion secundaria: obras sin reportar.

Ejemplo:

```txt
Lun
17/06
------------------------------------------------
Partes
[ AXION - Emilio Castelar      Cerrado ]
[ YPF - Av. Siempre Viva       Pendiente ]

Sin reportar
  Shell - Obra Norte
  Axion - Obra Sur
```

## Tarjetas de partes existentes

Las tarjetas representan partes reales y deben ser el contenido visual principal.

Contenido minimo:

- Nombre de obra/proyecto.
- Estado.
- Cantidad de registros.
- Total de horas.
- Descripcion breve si existe.

Ejemplo visual:

```txt
| AXION - Emilio Castelar        Cerrado
| 4 registros - 36 hs
| Faltas y enfermedad
```

El color de obra se muestra como barra lateral fina, no como fondo completo.

```tsx
<button className="relative w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 pl-3 text-left shadow-sm hover:border-blue-300 hover:bg-blue-50/40">
  <span
    className="absolute left-0 top-0 h-full w-1 rounded-l-md"
    style={{ backgroundColor: projectColor }}
  />
  ...
</button>
```

Reglas:

- Click navega a `/parte-diario/:id`.
- No abrir modal en primera version.
- No usar tarjetas grandes.
- No usar fondo de color fuerte.
- Mantener altura compacta.

## Obras sin reportar

Las obras sin parte diario deben mostrarse debajo de los partes existentes, con menor peso visual.

No deben competir con las tarjetas de partes existentes.

Formato recomendado:

- Una seccion con borde superior punteado.
- Titulo pequeno `Sin reportar`.
- Cada obra como fila sutil de baja altura.
- Punto o barra minima con el color de obra.

Ejemplo:

```tsx
<div className="mt-3 border-t border-dashed border-slate-200 pt-2">
  <div className="mb-1 text-[9px] font-semibold uppercase text-slate-400">
    Sin reportar
  </div>
  <button className="flex min-h-6 w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px] text-slate-500 hover:bg-slate-50 hover:text-slate-700">
    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: projectColor }} />
    <span className="truncate">AXION - Emilio Castelar 1003</span>
  </button>
</div>
```

Reglas:

- Click crea un parte nuevo prellenado con `idproyecto` y `fecha`.
- Si hay muchas obras sin reportar, mostrar las primeras 4 o 5.
- Luego mostrar una fila `+ N obras sin reportar`.
- La expansion puede resolverse inline o con modal en una version posterior.

## Color por obra

Cada obra debe tener un color estable derivado de `idproyecto`.

No usar colores aleatorios.

Propuesta:

```ts
const PROJECT_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#65a30d",
  "#be123c",
];

const getProjectColor = (idproyecto?: number | string | null) => {
  const id = Number(idproyecto ?? 0);
  return PROJECT_COLORS[Math.abs(id) % PROJECT_COLORS.length];
};
```

Uso:

- Barra lateral en tarjetas de partes.
- Punto pequeno en obras sin reportar.
- No colorear toda la tarjeta.

## Datos necesarios

Para la vista semanal hacen falta dos conjuntos de datos:

1. Partes diarios existentes entre `desde` y `hasta`.
2. Obras activas esperadas para reportar en ese periodo.

Con esos datos se calcula por dia:

- `partes`: partes existentes del dia.
- `sin_reportar`: obras activas que no tienen parte ese dia.

## Opcion A: calcular en frontend

Usar `dataProvider.getList("parte-diario")` con filtro semanal:

```ts
filter: {
  fecha: { gte: weekStart, lte: weekEnd },
  idproyecto,
  estado,
  q,
}
```

Y traer proyectos activos con `dataProvider.getList("proyectos")`.

Ventajas:

- Menos backend nuevo.
- Rapido para prototipo.

Desventajas:

- La regla de "obra que debe reportar" queda en frontend.
- Puede duplicar logica de negocio.
- Puede ser impreciso si hay fechas de inicio, fin, estado de obra, pausas o reglas por calendario.

## Opcion B recomendada: endpoint especifico

Crear endpoint backend:

```txt
GET /parte-diario/panel?desde=2026-06-15&hasta=2026-06-21&idproyecto=&estado=&q=
```

Respuesta propuesta:

```ts
type ParteDiarioPanelResponse = {
  desde: string;
  hasta: string;
  dias: ParteDiarioPanelDia[];
};

type ParteDiarioPanelDia = {
  fecha: string;
  partes: ParteDiarioPanelParte[];
  sin_reportar: ParteDiarioPanelProyecto[];
};

type ParteDiarioPanelParte = {
  id: number | string;
  idproyecto: number | string;
  proyecto_nombre: string;
  fecha: string;
  estado: "pendiente" | "cerrado" | string;
  descripcion?: string | null;
  registros: number;
  total_horas: number;
};

type ParteDiarioPanelProyecto = {
  idproyecto: number | string;
  proyecto_nombre: string;
};
```

Ventajas:

- Centraliza reglas de obras activas.
- Reduce llamadas y transformaciones en frontend.
- Escala mejor si aparecen feriados, obras pausadas o reglas por proyecto.

Desventajas:

- Requiere backend nuevo.

## Reglas de calculo

Para cada dia de la semana:

1. Obtener partes diarios cuya `fecha` sea igual al dia.
2. Obtener obras activas que deben reportar ese dia.
3. Para cada obra activa:
   - Si existe parte para esa obra y dia, mostrar en `partes`.
   - Si no existe, mostrar en `sin_reportar`.

La definicion exacta de "obra activa" debe quedar en backend.

Regla inicial sugerida:

- Proyecto no eliminado.
- Proyecto activo o con estado operativo equivalente.
- Si existen fechas de inicio/fin, el dia debe estar dentro del rango.

## Navegacion y acciones

Acciones principales:

- Semana anterior: resta 7 dias.
- Semana siguiente: suma 7 dias.
- Hoy: centra la semana actual.
- Selector de dia: permite elegir cualquier fecha y mueve el panel a la semana que contiene esa fecha.
- Crear: abre create normal.
- Click en tarjeta de parte: navega a edit.
- Click en obra sin reportar: navega a create con defaults.

## Selector de dia

El panel debe incluir un selector de fecha para saltar rapidamente a una semana especifica sin navegar semana por semana.

Comportamiento:

- El usuario selecciona un dia cualquiera.
- El panel calcula el lunes de la semana de ese dia.
- La vista se actualiza al rango lunes-domingo correspondiente.
- El selector muestra el dia seleccionado o el inicio de la semana, segun resulte mas claro en UI.
- La accion no crea ni modifica partes; solo cambia la semana visible.

Ubicacion recomendada:

- En la toolbar, junto al rango semanal.
- Debe ser compacto, similar a los inputs de fecha del resto del sistema.

Ejemplo:

```txt
<  15/06/2026 - 21/06/2026  [ Ir a dia: 17/06/2026 ]  >  Hoy
```

Implementacion sugerida:

```ts
const handleSelectedDateChange = (value: string) => {
  const selectedDate = parseDate(value);
  setCurrentWeekStart(getWeekStart(selectedDate));
};
```

Reglas:

- Si el usuario elige una fecha invalida, mantener la semana actual.
- Si el usuario elige un dia de la semana visible, no debe recargar innecesariamente.
- El valor debe serializarse en query params si la vista usa estado de URL.
- El boton `Hoy` debe actualizar tambien el selector.

Ruta de create con defaults propuesta:

```txt
/parte-diario/create?idproyecto=123&fecha=2026-06-17
```

Si el create actual no lee query params, agregar soporte en `ParteDiarioCreate` para inicializar `defaultValues`.

## Estados visuales

Parte cerrado:

- Badge verde, reutilizando helpers actuales.

Parte pendiente:

- Badge neutral o ambar, reutilizando helpers actuales.

Dia actual:

- Header con fondo `bg-blue-50/50` o borde superior azul.

Dia sin partes:

- Mostrar `Sin partes` en texto pequeno.
- Si ademas hay obras sin reportar, mostrar seccion `Sin reportar`.

Dia completo:

- Si todas las obras reportaron, opcionalmente mostrar texto pequeno `Todas reportadas`.

## Responsive

Desktop:

- Grilla de 7 columnas.
- `divide-x divide-slate-200`.
- Columnas con scroll vertical interno.

Mobile:

- No comprimir 7 columnas.
- Usar scroll horizontal con ancho fijo por dia.

```tsx
<div className="grid grid-flow-col auto-cols-[260px] overflow-x-auto">
```

Las tarjetas deben mantener texto truncado y altura estable.

## Performance

El rango inicial es una semana, por lo que el volumen esperado es bajo.

Recomendaciones:

- Pedir solo `desde` y `hasta`.
- Evitar pedir `detalles` completos si solo se necesita cantidad y total de horas.
- Si se usa endpoint especifico, devolver `registros` y `total_horas` ya calculados.
- Mantener `perPage` alto si se usa `getList`, por ejemplo `200`, para evitar paginacion accidental dentro de la semana.

## Componentizacion sugerida

```txt
panel.tsx
  ParteDiarioPanel
  ParteDiarioPanelToolbar
  ParteDiarioWeekGrid
  ParteDiarioDayColumn
  ParteDiarioCard
  ParteDiarioMissingProjectRow
```

Helpers:

```txt
getWeekRange(date)
formatDayHeader(date)
groupPartesByDate(partes)
getProjectColor(idproyecto)
buildCreateParteDiarioUrl(idproyecto, fecha)
```

## Criterios de aceptacion

- La pantalla muestra una semana completa de lunes a domingo.
- Cada parte diario aparece en la columna de su fecha.
- Cada tarjeta permite abrir la edicion del parte.
- Las obras sin reportar aparecen debajo de los partes del dia con menor jerarquia visual.
- El click en una obra sin reportar abre creacion con proyecto y fecha prellenados.
- Los colores por obra son estables entre refrescos.
- El panel conserva la estetica actual: sobrio, compacto, blanco, bordes suaves y tipografia chica.
- La vista mobile no comprime las 7 columnas; usa scroll horizontal.
- Los filtros de proyecto, estado y busqueda afectan el panel.
- El codigo no duplica innecesariamente constantes ya existentes en `parte-diario/constants.ts`.

## Riesgos y decisiones pendientes

- Definir con precision que proyectos deben considerarse "obras activas".
- Confirmar si sabados y domingos deben mostrar obras sin reportar.
- Confirmar si una obra puede tener mas de un parte por dia. Si no puede, reforzar regla en backend.
- Confirmar si el panel debe mostrar partes cerrados y pendientes juntos o separar visualmente.
- Confirmar si el create debe aceptar defaults por query params o por `state` de React Router.

## Implementacion recomendada por etapas

1. Frontend inicial con `dataProvider.getList("parte-diario")` y filtros por semana.
2. Grilla semanal con tarjetas de partes existentes.
3. Color estable por obra.
4. Endpoint backend `/parte-diario/panel` para incluir `sin_reportar`.
5. Render de obras sin reportar debajo de cada dia.
6. Navegacion a create prellenado.
7. Toggle o ruta final para acceder desde la UI.
