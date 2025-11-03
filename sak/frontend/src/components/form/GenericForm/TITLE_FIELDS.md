# Title Fields y Comportamiento de Secciones

## Resumen

GenericForm ahora soporta campos "título" y comportamiento dinámico de colapso de secciones basado en el modo (create/edit).

## Features

### 1. Campos Título (`isTitle`)

Marca campos que representan el título/resumen del registro. Estos campos se concatenan para mostrar un subtítulo en la sección.

```typescript
{
  name: "tipo",
  label: "Tipo de Solicitud",
  type: "select",
  isTitle: true,  // ✅ Marca como campo título
  options: [...]
}
```

### 2. Subtítulo de Sección (`showTitleSubtitle`)

Cuando está habilitado, la sección muestra un subtítulo concatenando los valores de los campos marcados con `isTitle`.

```typescript
{
  title: "Datos Generales",
  showTitleSubtitle: true,  // ✅ Muestra subtítulo con campos título
  fields: [...]
}
```

**Ejemplo de output:**
```
┌─────────────────────────────────────┐
│ Datos Generales              ▼      │
│ Compra Directa - 30/10/2025         │  ← Subtítulo generado
├─────────────────────────────────────┤
│ [Campos del formulario...]          │
└─────────────────────────────────────┘
```

### 3. Comportamiento de Colapso (`defaultOpenBehavior`)

Controla si la sección está colapsada o expandida según el modo:

| Valor | Create Mode | Edit Mode |
|-------|-------------|-----------|
| `'always'` | Usa `defaultOpen` | Usa `defaultOpen` |
| `'create-only'` | ✅ Abierto | ❌ Cerrado |
| `'edit-only'` | ❌ Cerrado | ✅ Abierto |

```typescript
{
  title: "Datos Generales",
  defaultOpen: true,
  defaultOpenBehavior: "create-only",  // ✅ Solo abierto en create
  fields: [...]
}
```

## Caso de Uso Completo

### Configuración

```typescript
export const solicitudFormConfig: FormConfig<SolicitudFormValues> = {
  resource: "solicitudes",
  title: "Solicitud de Compra",
  
  sections: [
    {
      title: "Datos Generales",
      defaultOpenBehavior: "create-only",  // Abierto en create, cerrado en edit
      showTitleSubtitle: true,             // Mostrar subtítulo
      fields: [
        {
          name: "tipo",
          label: "Tipo de Solicitud",
          type: "select",
          isTitle: true,  // Campo título #1
          required: true,
          options: solicitudTipoChoices.map(choice => ({
            value: choice.id,
            label: choice.name
          }))
        },
        {
          name: "fecha_necesidad",
          label: "Fecha de Necesidad",
          type: "date",
          isTitle: true,  // Campo título #2
          required: true
        },
        {
          name: "solicitante_id",
          label: "Solicitante",
          type: "number",
          disabled: true,
          fullWidth: true
        },
        {
          name: "comentario",
          label: "Comentarios Adicionales",
          type: "textarea",
          fullWidth: true
        }
      ]
    },
    {
      title: "Artículos Solicitados",
      defaultOpen: true,
      detailItems: {
        name: "detalles",
        config: { ... }
      }
    }
  ]
};
```

### Comportamiento Resultante

#### En CREATE Mode (recordId = undefined):
```
┌─────────────────────────────────────┐
│ Datos Generales              ▼      │  ← ABIERTO
│                                      │
├─────────────────────────────────────┤
│ Tipo de Solicitud         [      ▼] │
│ Fecha de Necesidad        [📅      ] │
│ Solicitante              [         ] │
│ Comentarios              [         ] │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Artículos Solicitados        ▼      │  ← ABIERTO
│ [Artículos...]                       │
└─────────────────────────────────────┘
```

#### En EDIT Mode (recordId = 123):
```
┌─────────────────────────────────────┐
│ Datos Generales              ▶      │  ← CERRADO
│ Compra Directa - 30/10/2025         │  ← Subtítulo visible
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Artículos Solicitados        ▼      │  ← ABIERTO
│ [Artículos...]                       │
└─────────────────────────────────────┘
```

## Renderizado de Valores en Subtítulo

El sistema maneja diferentes tipos de campos automáticamente:

### Select Fields
```typescript
// Valor en formData: "directa"
// Options: [{ value: "directa", label: "Compra Directa" }]
// Output: "Compra Directa"  ← Usa el label, no el value
```

### Date Fields
```typescript
// Valor en formData: "2025-10-30"
// Output: "30/10/2025"  ← Formateado con toLocaleDateString()
```

### Text/Number Fields
```typescript
// Valor en formData: "123"
// Output: "123"  ← Convertido a string
```

### Null/Empty Values
```typescript
// Valor en formData: null | undefined | ""
// Output: (omitido)  ← No se incluye en el subtítulo
```

### Concatenación
```typescript
// Campo 1: "Compra Directa"
// Campo 2: "30/10/2025"
// Campo 3: null
// Output: "Compra Directa - 30/10/2025"  ← Separados por " - "
```

## API Reference

### FieldConfig

```typescript
interface FieldConfig<T> {
  // ... campos existentes ...
  
  /**
   * Marca este campo como parte del título del registro.
   * Usado para generar el subtítulo de la sección.
   */
  isTitle?: boolean;
}
```

### SectionConfig

```typescript
interface SectionConfig<T> {
  // ... campos existentes ...
  
  /**
   * Controla el comportamiento de colapso según el modo
   * - 'always': Usa defaultOpen siempre
   * - 'create-only': Abierto en create, cerrado en edit
   * - 'edit-only': Cerrado en create, abierto en edit
   * @default 'always'
   */
  defaultOpenBehavior?: 'always' | 'create-only' | 'edit-only';
  
  /**
   * Muestra un subtítulo concatenando los campos marcados con isTitle
   * @default false
   */
  showTitleSubtitle?: boolean;
}
```

### CollapsibleFormSection

```typescript
interface CollapsibleFormSectionProps {
  title: string | ReactNode;
  
  /**
   * Subtítulo opcional mostrado debajo del título
   */
  subtitle?: string;
  
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  // ... otros props ...
}
```

## Ejemplos Adicionales

### Subtítulo con Múltiples Campos

```typescript
fields: [
  { name: "codigo", isTitle: true },      // "SOL-001"
  { name: "tipo", isTitle: true },        // "Compra Directa"
  { name: "estado", isTitle: true },      // "Pendiente"
]
// Subtítulo: "SOL-001 - Compra Directa - Pendiente"
```

### Solo Subtítulo, Sin Comportamiento Dinámico

```typescript
{
  title: "Información",
  showTitleSubtitle: true,      // ✅ Mostrar subtítulo
  defaultOpenBehavior: 'always', // ✅ Comportamiento normal
  defaultOpen: true,
  fields: [...]
}
```

### Solo Comportamiento Dinámico, Sin Subtítulo

```typescript
{
  title: "Detalles",
  defaultOpenBehavior: 'edit-only',  // ✅ Cerrado en create
  showTitleSubtitle: false,          // ❌ Sin subtítulo
  fields: [...]
}
```

## Mejoras Futuras Posibles

- [ ] Formato personalizado de subtítulo (callback)
- [ ] Separator personalizado (en vez de " - ")
- [ ] Soporte para campos de referencia/combobox
- [ ] Animación de transición de subtítulo
- [ ] Ocultar subtítulo cuando la sección está abierta

## Archivos Modificados

1. `types.ts` - Agregados `isTitle`, `defaultOpenBehavior`, `showTitleSubtitle`
2. `FormSection.tsx` - Lógica de subtítulo y comportamiento dinámico
3. `GenericForm.tsx` - Detección de modo create/edit
4. `CollapsibleFormSection.tsx` - Soporte de subtítulo
5. `form.config.ts` - Ejemplo de uso en solicitudes
