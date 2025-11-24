# Frontend_pattern

> **Proposito:** estandarizar la construccion de CRUDs de frontend bajo un patron generico de la plataforma (Next.js + ra-core).  
> **Alcance:** modulos registrados dentro de `AdminApp` (Next.js App Router + ra-core) que necesiten vistas de listado, formulario y wrappers CRUD.  
> **Audiencia:** agentes o desarrolladores que deban clonar el patron sin conocer el contexto completo del proyecto.

---

## 1. Contexto del patron

- **Stack base:** Next 14 (app router) + ra-core + componentes locales (`List`, `DataTable`, `SimpleForm`, etc.).  
- **Principios:** un unico formulario reutilizable (`Form`) para `Create` y `Edit`, un archivo `model.ts` con el dominio aislado, y una vista de lista responsiva que cambia automaticamente entre grilla y tarjetas mediante `DataTable` + `useIsMobile`.  
- **Referencia oficial:** este documento describe el flujo completo; cualquier implementacion debe adherir a estos pasos aunque el dominio cambie.

---

## 2. Estructura minima de carpetas

```
frontend/src/app/resources/<entidad>/
|-- List.tsx        # Vista principal con filtros + DataTable
|-- form.tsx        # Formulario reutilizable (Create/Edit)
|-- create.tsx      # Wrapper <Create> que usa Form
|-- edit.tsx        # Wrapper <Edit> que usa Form
|-- show.tsx        # (opcional) Detalle solo-lectura
|-- model.ts        # Dominio, tipos, defaults, validaciones
|-- index.ts        # Re-exporta todo para AdminApp
```



> **Nota:** la carpeta debe exportarse en `src/app/resources/index.ts` y la entidad tiene que registrarse en `src/app/admin/AdminApp.tsx` con `Resource`.

## 2.1 Plantillas disponibles

Para acelerar la creacion de nuevos recursos se incluyen archivos base en `doc/03-devs/patterns_frontend/` (formato Markdown con el codigo dentro de bloques):

- `model.template.md`
- `form.template.md`
- `List.template.md`
- `create.template.md`
- `edit.template.md`
- `show.template.md`
- `index.template.md`

Cada seccion del instructivo hace referencia directa a uno de estos archivos. Copialos dentro de la carpeta de la entidad y reemplaza los nombres/constantes marcados como `MyEntity`.

---

## 3. Paso a paso para un CRUD nuevo

### 3.1 Modelar el dominio (`model.ts`)
1. Partir de `doc/03-devs/patterns_frontend/model.template.md` y copiar el bloque de codigo como `model.ts`.  
2. Mantener las secciones comentadas: **CONFIG**, **TIPOS**, **DEFAULTS**, **VALIDACIONES**, **TRANSFORMACIONES/HELPERS**.  
3. Use helpers de `@/lib/form-detail-schema` (p. ej. `referenceField`, `stringField`) para describir cada columna.  
4. Defina `choices`, `references`, reglas de validacion y tipos `FormValues`.  
5. No introducir JSX ni dependencias de UI: el archivo debe ser importable desde utilidades o tests.

### 3.2 Formularios reutilizables (`form.tsx`)
1. Copie el bloque principal de `doc/03-devs/patterns_frontend/form.template.md` como punto de partida.  
2. Estructure el componente con las siguientes piezas:  
   - `SimpleForm` como contenedor principal.  
   - `FormLayout` + `FormSimpleSection` / `FormDetailSection` para dividir cabeceras y repetibles.  
   - Inputs reutilizables (`TextInput`, `SelectInput`, `ReferenceInput`, `Textarea`, etc.).  
3. Los efectos con datos externos van via `useDataProvider` + `useQuery` o `ReferenceInput` directo.  
4. Use `useWatch` y helpers del modelo (p. ej. funciones que calculan defaults) para autopoblar campos dependientes.  
5. Los subformularios de detalle deben usar `FormDetailSection`, `FormDetailCardList` y `FormDetailFormDialog` para brindar una UX uniforme en desktop/mobile.  
6. Centralizar formatters y calculos (como `CURRENCY_FORMATTER`) dentro del formulario, manteniendo la logica de negocio en el modelo.

### 3.3 Vista de listado (`List.tsx`)
1. Copie `doc/03-devs/patterns_frontend/List.template.md` como base, manteniendo el `perPage={10}` para garantizar 10 filas por página.  
2. Defina un arreglo `filters` de elementos `<TextInput>`, `<ReferenceInput>` o `<SelectInput>`. Todos deben tener `key` y `source`.  
3. Cree `ListActions` reutilizando `<FilterButton filters={filters} />`, `<CreateButton />` y `<ExportButton />`.  
4. Declare el componente:
   ```tsx
   export const MiEntidadList = () => (
     <List filters={filters} actions={<ListActions />} perPage={25} sort={{ field: "created_at", order: "DESC" }}>
       <DataTable rowClick="edit">
         <DataTable.Col source="id" label="ID">
           <TextField source="id" />
         </DataTable.Col>
         {/* ...resto de columnas */}
       </DataTable>
     </List>
   );
   ```
5. `List` debe conservar `perPage={10}` salvo que exista un requerimiento explícito diferente.  
6. `DataTable` ya detecta pantallas pequenas mediante `useIsMobile` y cambia a tarjetas. No remover el componente ni renderizar tablas HTML personalizadas si se quiere conservar el comportamiento responsive.  
7. Para estados o acciones especiales use componentes como `BadgeField`, `NumberField`, `ReferenceField` y menus (`DropdownMenu`) siguiendo el estilo del kit.

### 3.4 Wrappers de Create/Edit/Show
- Copiar `doc/03-devs/patterns_frontend/create.template.md`, `edit.template.md` y `show.template.md` (opcional) para mantener consistencia.  
- `create.tsx` y `edit.tsx` solo importan `Create` / `Edit` y renderizan `<Form />`.  
- Mantenga textos coherentes en `title` para breadcrumbs de `List`.  
- Si la entidad necesita `Show`, use el patron ya definido en recursos existentes que muestren detalles (ej., `crm-oportunidades/show.tsx`).

### 3.5 Registro en el Admin
1. Copiar `doc/03-devs/patterns_frontend/index.template.md` como `index.ts` y ajustar los exports.  
2. Agregar `<Resource name="mi/entidad" list={MiEntidadList} create={MiEntidadCreate} edit={MiEntidadEdit} />` dentro de `AdminApp`.  
3. Si hay rutas personalizadas, declararlas en `CustomRoutes` siguiendo la misma seccion donde se registran las demas entidades.

---

## 4. Reglas del patron (cheat-sheet)

- **Un solo formulario**: `Form` debe servir para crear y editar, aprovechando `SimpleForm` y `FormToolbar`.  
- **Filtros alineados**: `filters` y `FilterButton` siempre sincronizados; no renderizar filtros sueltos fuera de la barra.  
- **Paginacion consistente**: `List` arranca con `perPage={10}` para mostrar 10 filas iniciales; solo modificarlo con un requerimiento documentado.  
- **DataTable por defecto**: respeta ordenamiento, seleccion masiva y vista mobile. Cualquier personalizacion debe hacerse mediante props (`mobileConfig`, `rowClassName`) y nunca reemplazando el componente.  
- **Acciones asincronicas**: usar `useDataProvider`, `useNotify`, `useRefresh`, `useRedirect` para aprobaciones, eliminaciones u otros efectos secundarios.  
- **Dominio aislado**: `model.ts` no conoce React; `form.tsx` solo importa helpers del modelo.  
- **Consistencia de exports**: `index.ts` expone `List`, `Create`, `Edit` (y `Form` si se requiere reutilizar).  
- **Internacionalizacion**: labels y mensajes deben estar en espanol neutro, coincidiendo con el resto del panel.

---

## 5. Checklist previo a abrir PR

- [ ] Carpeta `frontend/src/app/resources/<entidad>` creada con todos los archivos mencionados.  
- [ ] `model.ts` incluye configuraciones, tipos y schemas siguiendo la plantilla definida.  
- [ ] `form.tsx` reutiliza `SimpleForm`, `FormLayout` y componentes UI del kit.  
- [ ] `List.tsx` implementa filtros declarativos, `ListActions` y `DataTable` (sin tablas manuales).  
- [ ] `Create` / `Edit` importan el mismo formulario.  
- [ ] Recursos exportados en `src/app/resources/index.ts` y registrados en `AdminApp`.  
- [ ] Probadas las vistas en desktop y mobile (devtools responsive) para confirmar que la tabla cambia a tarjetas automaticamente.  
- [ ] Acciones especiales (aprobaciones, exportaciones, etc.) usan `useDataProvider` y manejan notificaciones.

Cumplir con estos pasos garantiza que cualquier nueva entidad mantenga el patron responsivo y reutilizable definido para todo el panel administrativo.
