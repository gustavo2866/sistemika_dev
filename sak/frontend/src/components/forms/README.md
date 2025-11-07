# Componentes de Formulario Genéricos - Guía de Uso

Esta guía documenta todos los componentes genéricos reutilizables creados para formularios.

## 📦 Componentes Disponibles

### 1. Combobox
Selector con búsqueda para referencias.

```tsx
import { Combobox, useReferenceOptions } from "@/components/forms";

const { options, loading } = useReferenceOptions("articulos", "nombre");

<Combobox
  value={formValue}
  onChange={(newValue) => setValue("field", newValue)}
  options={options}
  loading={loading}
  placeholder="Selecciona un articulo"
  searchPlaceholder="Buscar articulo..."
  loadingMessage="Cargando..."
  emptyMessage="Sin resultados."
/>
```

### 2. CollapsibleSection
Sección colapsable con header y múltiples opciones de configuración.

**Parámetros disponibles:**

```tsx
import { CollapsibleSection } from "@/components/forms";

<CollapsibleSection
  // Básico
  title="Datos generales"
  subtitle="Información básica"  // String estático
  
  // O subtitle dinámico con función
  subtitle={() => `Usuario: ${userName} - ${date}`}
  
  // Control de colapsado
  collapsible={true}          // Si puede colapsarse (default: true)
  defaultOpen={true}          // Estado inicial (default: true)
  
  // Estilos
  variant="default"           // "default" | "outlined" | "ghost"
  contentPadding="md"         // "none" | "sm" | "md" | "lg"
  className="my-custom-class" // Clase CSS adicional
  contentClassName="p-2"      // Clase CSS para el contenido
  
  // Callbacks
  onToggle={(isOpen) => console.log("Toggle:", isOpen)}
  onOpen={() => console.log("Abierto")}
  onClose={() => console.log("Cerrado")}
  
  // Contenido adicional en header
  headerContent={<Button>Acción</Button>}
>
  {/* Contenido de la sección */}
</CollapsibleSection>
```

**Ejemplos de uso:**

```tsx
// Sección NO colapsable (siempre visible)
<CollapsibleSection
  title="Datos requeridos"
  collapsible={false}
>
  <RequiredFields />
</CollapsibleSection>

// Sección con subtitle dinámico
<CollapsibleSection
  title="Resumen"
  subtitle={() => `Total: ${items.length} items - $${total}`}
  defaultOpen={false}
>
  <Summary />
</CollapsibleSection>

// Sección con estilo especial
<CollapsibleSection
  title="Datos avanzados"
  variant="outlined"
  contentPadding="lg"
  onOpen={() => trackEvent("advanced_section_opened")}
>
  <AdvancedOptions />
</CollapsibleSection>
```

### 3. FormField
Wrapper para inputs con label y mensaje de error.

```tsx
import { FormField } from "@/components/forms";

<FormField
  label="Nombre"
  error={errors.nombre?.message}
  required
>
  <Input {...register("nombre")} />
</FormField>
```

### 4. FormDialog
Dialog para crear/editar items.

```tsx
import { FormDialog } from "@/components/forms";

<FormDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  title={isEditing ? "Editar item" : "Agregar item"}
  description="Completa los datos del item"
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  submitLabel={isEditing ? "Actualizar" : "Agregar"}
>
  {/* Campos del formulario */}
</FormDialog>
```

### 5. DetailItemCard
Card para mostrar un item de detalle con botones de acción.

```tsx
import { DetailItemCard } from "@/components/forms";

<DetailItemCard
  onEdit={() => handleEdit(index)}
  onDelete={() => handleDelete(index)}
>
  {/* Contenido del item */}
  <div>
    <Badge>{item.nombre}</Badge>
    <p>{item.descripcion}</p>
  </div>
</DetailItemCard>
```

### 6. DetailList
Lista de items con estado vacío.

```tsx
import { DetailList } from "@/components/forms";

<DetailList
  items={sortedItems}
  renderItem={(item, index) => (
    <div>
      <Badge>{item.nombre}</Badge>
      <p>{item.descripcion}</p>
    </div>
  )}
  onEdit={(item, index) => handleEdit(index)}
  onDelete={(item, index) => handleDelete(index)}
  emptyMessage="No hay items agregados"
  keyExtractor={(item) => item.id || item.tempId}
/>
```

### 7. EmptyState
Mensaje para listas vacías.

```tsx
import { EmptyState } from "@/components/forms";
import { PackageOpen } from "lucide-react";

<EmptyState 
  message="No hay items para mostrar"
  Icon={PackageOpen}
/>
```

### 8. AddItemButton
Botón para agregar items.

```tsx
import { AddItemButton } from "@/components/forms";

<AddItemButton
  onClick={handleAdd}
  label="Agregar articulo"
  ref={buttonRef}
/>
```

### 9. MinItemsValidation
Mensaje de validación para mínimo de items.

```tsx
import { MinItemsValidation } from "@/components/forms";

<MinItemsValidation
  currentCount={fields.length}
  minItems={1}
  itemName="articulo"
/>
```

## 🎣 Hooks Disponibles

### useReferenceOptions
Carga opciones de una referencia desde la API.

```tsx
import { useReferenceOptions } from "@/components/forms";

const { options, loading } = useReferenceOptions(
  "articulos",      // resource
  "nombre",         // optionTextField
  100,              // perPage
  "nombre",         // sortField
  "ASC"            // sortOrder
);
```

### useDetailCRUD
Gestiona la lógica completa de items detalle (CRUD).

**IMPORTANTE**: Este hook NO crea internamente el form. Debes crear el form con `useForm` y pasárselo como parámetro `detalleForm`.

```tsx
import { useForm } from "react-hook-form";
import { useDetailCRUD } from "@/components/forms";

// 1. Crear el form para el detalle
const detalleForm = useForm<DetalleFormValues>({
  defaultValues: detalleDefaultValues,
});

// 2. Pasar el form a useDetailCRUD
const {
  fields,
  sortedEntries,
  dialogOpen,
  setDialogOpen,
  editingIndex,
  setEditingIndex,
  handleAdd,
  handleEdit,
  handleDelete,
  handleSubmit,
  handleCancel,
} = useDetailCRUD<DetalleFormValues, DetalleType>({
  fieldName: "detalles",
  detalleForm,  // ⚠️ Pasar el form creado con useForm
  defaultValues: detalleDefaultValues,
});

// 3. Usar en el formulario
const handleSubmitDetalle = detalleForm.handleSubmit((data) => {
  // Validar y normalizar data
  const normalized = { ...data };
  handleSubmit(normalized, () => {
    // Callback opcional después de agregar
  });
});
```

### useAutoInitializeField
Inicializa automáticamente un campo con datos del usuario.

```tsx
import { useAutoInitializeField } from "@/components/forms";

// Auto-llenar solicitante_id con el id del usuario actual
useAutoInitializeField("solicitante_id", "id", !isEditing);
```

## 🎯 FormLayout - Configuración Avanzada de Secciones

`FormLayout` permite definir todas las secciones de un formulario mediante un array de configuración, garantizando comportamiento consistente en todas las entidades.

### Parámetros de FormLayout

```tsx
import { FormLayout } from "@/components/forms";

<FormLayout
  sections={[
    {
      id: "section1",
      title: "Título",
      subtitle: "Subtítulo" | (() => "Subtítulo dinámico"),
      collapsible: true,
      defaultOpen: true,
      variant: "default" | "outlined" | "ghost",
      contentPadding: "none" | "sm" | "md" | "lg",
      className: "custom-class",
      contentClassName: "custom-content-class",
      onToggle: (isOpen) => {},
      onOpen: () => {},
      onClose: () => {},
      children: <YourContent />
    }
  ]}
  spacing="md"  // "none" | "sm" | "md" | "lg"
  className="custom-layout-class"
/>
```

### Ejemplos por Tipo de Entidad

#### 1. Entidad Simple (sin detalle)
```tsx
// Ejemplo: Categorías, Tags, etc.
<FormLayout
  sections={[
    {
      id: "datos",
      title: "Datos de la categoría",
      collapsible: false,  // No colapsable, siempre visible
      children: (
        <div className="grid gap-4">
          <TextInput source="nombre" label="Nombre" />
          <TextInput source="descripcion" label="Descripción" multiline />
          <SelectInput source="estado" label="Estado" choices={estadoChoices} />
        </div>
      )
    }
  ]}
/>
```

#### 2. Entidad con Secciones Múltiples
```tsx
// Ejemplo: Usuarios, Clientes
const userSubtitle = () => `${email} - ${role}`;

<FormLayout
  sections={[
    {
      id: "personal",
      title: "Datos personales",
      subtitle: userSubtitle,
      defaultOpen: !idValue,
      children: <DatosPersonales />
    },
    {
      id: "contacto",
      title: "Información de contacto",
      defaultOpen: false,
      contentPadding: "lg",
      children: <DatosContacto />
    },
    {
      id: "configuracion",
      title: "Configuración",
      variant: "outlined",
      defaultOpen: false,
      onOpen: () => trackEvent("config_opened"),
      children: <Configuracion />
    }
  ]}
  spacing="lg"
/>
```

#### 3. Entidad Maestro-Detalle
```tsx
// Ejemplo: Solicitudes, Facturas, Órdenes
<FormLayout
  sections={[
    {
      id: "cabecera",
      title: "Datos generales",
      subtitle: () => `${tipo} - ${fecha} - ${comentario.slice(0, 25)}`,
      defaultOpen: !idValue,
      children: <CabeceraDatos />
    },
    {
      id: "detalles",
      title: "Artículos seleccionados",
      defaultOpen: true,
      collapsible: true,
      children: <DetalleItemsSection />
    }
  ]}
/>
```

#### 4. Entidad Compleja (muchas secciones)
```tsx
// Ejemplo: Proyectos completos, Configuración del sistema
<FormLayout
  sections={[
    {
      id: "basico",
      title: "Información básica",
      collapsible: false,  // Siempre visible
      children: <BasicInfo />
    },
    {
      id: "detalles",
      title: "Detalles del proyecto",
      subtitle: () => `${faseActual} - ${progreso}%`,
      children: <ProjectDetails />
    },
    {
      id: "equipo",
      title: "Equipo de trabajo",
      children: <TeamSection />
    },
    {
      id: "tareas",
      title: "Tareas",
      children: <TasksSection />
    },
    {
      id: "documentos",
      title: "Documentos",
      variant: "outlined",
      defaultOpen: false,
      children: <DocumentsSection />
    },
    {
      id: "historial",
      title: "Historial de cambios",
      variant: "ghost",
      contentPadding: "sm",
      defaultOpen: false,
      children: <HistorySection />
    }
  ]}
  spacing="md"
/>
```

### Ventajas de Usar FormLayout

✅ **Consistencia**: Todas las entidades se comportan igual
✅ **Mantenibilidad**: Un solo lugar para cambiar comportamiento
✅ **Declarativo**: Código más legible y estructurado
✅ **Flexible**: Soporta entidades simples y complejas
✅ **Configurable**: Cada sección puede tener su propia configuración
✅ **Callbacks**: Control sobre eventos de apertura/cierre

### Cuándo Usar FormLayout vs CollapsibleSection

**Usa FormLayout cuando:**
- Quieras estandarizar el comportamiento de todas las secciones
- Tengas 2+ secciones
- Necesites configuración declarativa
- Quieras garantizar consistencia entre formularios

**Usa CollapsibleSection cuando:**
- Solo tienes 1 sección
- Necesites control muy específico sobre una sección individual
- Estés haciendo un componente reutilizable que incluye su propia sección

## 📝 Ejemplo Completo: Formulario Maestro-Detalle

```tsx
import {
  CollapsibleSection,
  FormField,
  FormDialog,
  AddItemButton,
  DetailList,
  MinItemsValidation,
  Combobox,
  useReferenceOptions,
  useAutoInitializeField,
  useDetailCRUD,
} from "@/components/forms";

const DetalleSection = () => {
  // 1. Crear el form para el detalle
  const detalleForm = useForm<DetalleFormValues>({
    defaultValues: { articulo_id: "", cantidad: 1 },
  });

  // 2. Usar useDetailCRUD pasando el form
  const {
    fields,
    sortedEntries,
    dialogOpen,
    setDialogOpen,
    editingIndex,
    handleAdd,
    handleSubmit,
    handleCancel,
  } = useDetailCRUD<DetalleFormValues, DetalleType>({
    fieldName: "detalles",
    detalleForm,  // ⚠️ Pasar el form
    defaultValues: { articulo_id: "", cantidad: 1 },
  });

  const { options, loading } = useReferenceOptions("articulos", "nombre");

  const handleSubmitDetalle = detalleForm.handleSubmit((data) => {
    const normalized = { ...data, articulo_id: Number(data.articulo_id) };
    handleSubmit(normalized);
  });

  return (
    <CollapsibleSection title="Items" defaultOpen>
      <AddItemButton 
        onClick={() => { handleAdd(); setDialogOpen(true); }}
        label="Agregar item"
      />

      <DetailList
        items={sortedEntries.map(e => e.item)}
        renderItem={(item) => (
          <div>
            <Badge>{item.nombre}</Badge>
            <p>{item.descripcion}</p>
          </div>
        )}
        onEdit={(_, index) => handleEdit(sortedEntries[index].originalIndex)}
        onDelete={(_, index) => handleDelete(sortedEntries[index].originalIndex)}
        emptyMessage="No hay items"
      />

      <MinItemsValidation 
        currentCount={fields.length}
        minItems={1}
        itemName="item"
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingIndex != null ? "Editar" : "Agregar"}
        onSubmit={handleSubmitDetalle}
        onCancel={handleCancel}
      >
        <FormField label="Articulo" required error={detalleForm.formState.errors.articulo_id?.message}>
          <Combobox
            value={detalleForm.watch("articulo_id")}
            onChange={(v) => detalleForm.setValue("articulo_id", v)}
            options={options}
            loading={loading}
          />
        </FormField>
      </FormDialog>
    </CollapsibleSection>
  );
};

const MiFormulario = () => {
  useAutoInitializeField("creador_id", "id", true);

  return (
    <SimpleForm>
      <CollapsibleSection title="Datos generales" defaultOpen>
        {/* Campos generales */}
      </CollapsibleSection>
      
      <DetalleSection />
    </SimpleForm>
  );
};
```

## 🎯 Beneficios

- ✅ **Reducción de código**: ~300-400 líneas por formulario maestro-detalle
- ✅ **Consistencia**: UI/UX uniforme en toda la aplicación
- ✅ **Mantenibilidad**: Cambios centralizados
- ✅ **Reutilización**: Todos los formularios pueden usar los mismos componentes
- ✅ **TypeScript**: Tipado completo para mejor DX
- ✅ **Accesibilidad**: ARIA labels y manejo de teclado incluido

## 📂 Estructura de Archivos

```
components/forms/
├── index.ts                          # Exportaciones
├── combobox.tsx                      # ✅ Selector con búsqueda
├── collapsible-section.tsx           # ✅ Sección colapsable
├── form-dialog.tsx                   # ✅ Dialog para CRUD
├── form-field.tsx                    # ✅ Wrapper de input
├── form-layout.tsx                   # Layout de formularios
├── add-item-button.tsx               # ✅ Botón agregar
├── detail-item-card.tsx              # ✅ Card de item
├── detail-list.tsx                   # ✅ Lista de items
├── empty-state.tsx                   # ✅ Estado vacío
├── min-items-validation.tsx          # ✅ Validación mínimo
└── hooks/
    ├── useReferenceOptions.ts        # ✅ Cargar opciones
    ├── useAutoInitializeField.ts     # ✅ Auto-inicializar
    └── useDetailCRUD.ts              # ✅ CRUD genérico
```
