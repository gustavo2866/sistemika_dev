# Patrones Oficiales de shadcn-admin-kit

Este documento contiene los patrones y referencias oficiales de **shadcn-admin-kit** consultados durante el desarrollo del sistema. Usar como guía para mantener consistencia en la implementación.

## 📚 Enlaces de Documentación Oficial

### Repositorio Principal
- **GitHub**: https://github.com/marmelab/shadcn-admin-kit
- **Descripción**: Repositorio oficial con código fuente y ejemplos
- **Uso**: Revisar componentes, estructura de archivos y ejemplos de implementación

### Documentación Web Oficial
- **Base**: https://marmelab.com/shadcn-admin-kit/docs/
- **Instalación**: https://marmelab.com/shadcn-admin-kit/docs/install
- **Quick Start**: https://marmelab.com/shadcn-admin-kit/docs/quick-start-guide

## 🎯 Patrones Implementados

### 1. Valores por Defecto en Formularios

#### ✅ Patrón Oficial Recomendado
**Fuente**: https://marmelab.com/shadcn-admin-kit/docs/create + https://marmelab.com/shadcn-admin-kit/docs/simpleform

**Método 1: A nivel de `<Create>` con prop `record`**
```tsx
export const FacturaCreate = () => {
  const { identity } = useGetIdentity();
  
  return (
    <Create record={{ usuario_responsable_id: identity?.id }}>
      <SimpleForm>
        <ReferenceInput source="usuario_responsable_id" reference="users">
          <SelectInput />
        </ReferenceInput>
      </SimpleForm>
    </Create>
  );
};
```

**Método 2: A nivel de `<SimpleForm>` con prop `defaultValues` (IMPLEMENTADO)**
```tsx
export const FacturaCreate = () => {
  const { identity } = useGetIdentity();
  
  const defaultValues = {
    tipo_comprobante: "A",
    usuario_responsable_id: identity?.id
  };

  return (
    <Create>
      <SimpleForm defaultValues={defaultValues}>
        <ReferenceInput source="usuario_responsable_id" reference="users">
          <SelectInput />
        </ReferenceInput>
      </SimpleForm>
    </Create>
  );
};
```

#### ❌ Evitar Patrones No Oficiales
- No usar `useEffect + form.setValue` (era el patrón que usábamos antes)
- No usar `defaultValue` en inputs individuales cuando ya hay `defaultValues` global
- No usar patrones de react-admin directamente (shadcn-admin-kit tiene sus propios patrones)

### 2. Componentes Base

#### Create Pages
**Fuente**: https://marmelab.com/shadcn-admin-kit/docs/create

**Props Principales del `<Create>`:**
- `record`: Inicializar formulario con un record (alternativa a defaultValues)
- `redirect`: Definir redirección después de crear
- `title`: Título personalizado de la página
- `transform`: Transformar datos antes de enviar al dataProvider

#### SimpleForm
**Fuente**: https://marmelab.com/shadcn-admin-kit/docs/simpleform

**Props Principales del `<SimpleForm>`:**
- `defaultValues`: Valores por defecto (object o function)
- `validate`: Función de validación
- `toolbar`: Toolbar personalizado
- `warnWhenUnsavedChanges`: Advertir sobre cambios no guardados

#### ReferenceInput
**Fuente**: https://marmelab.com/shadcn-admin-kit/docs/referenceinput

**Uso Estándar:**
```tsx
<ReferenceInput source="usuario_responsable_id" reference="users">
  <SelectInput />
</ReferenceInput>
```

## 🔧 Stack Tecnológico Oficial

**Fuente**: https://github.com/marmelab/shadcn-admin-kit#tech-stack

- **UI**: shadcn/ui & Radix UI
- **Styling**: Tailwind CSS
- **Icons**: Lucide
- **Routing**: React Router
- **API calls**: TanStack Query
- **Forms & Validation**: React Hook Form
- **Admin Framework**: Ra-Core
- **Type safety**: TypeScript

## 📖 Documentación por Componentes

### Inputs y Data Edition
- **AutocompleteInput**: https://marmelab.com/shadcn-admin-kit/docs/autocompleteinput
- **BooleanInput**: https://marmelab.com/shadcn-admin-kit/docs/booleaninput
- **NumberInput**: https://marmelab.com/shadcn-admin-kit/docs/numberinput
- **ReferenceInput**: https://marmelab.com/shadcn-admin-kit/docs/referenceinput
- **SelectInput**: https://marmelab.com/shadcn-admin-kit/docs/selectinput
- **TextInput**: https://marmelab.com/shadcn-admin-kit/docs/textinput

### Data Display
- **ReferenceField**: https://marmelab.com/shadcn-admin-kit/docs/referencefield
- **TextField**: https://marmelab.com/shadcn-admin-kit/docs/textfield
- **NumberField**: https://marmelab.com/shadcn-admin-kit/docs/numberfield
- **DateField**: https://marmelab.com/shadcn-admin-kit/docs/datefield

### Layout y UI
- **Layout**: https://marmelab.com/shadcn-admin-kit/docs/layout
- **AppSidebar**: https://marmelab.com/shadcn-admin-kit/docs/appsidebar
- **Breadcrumb**: https://marmelab.com/shadcn-admin-kit/docs/breadcrumb

## 🎨 Diferencias con react-admin

**Importante**: shadcn-admin-kit es diferente de react-admin tradicional:

1. **UI Components**: Usa shadcn/ui en lugar de Material-UI
2. **Styling**: Tailwind CSS nativo en lugar de JSS
3. **Form Handling**: React Hook Form directo
4. **TypeScript**: First-class support
5. **Patrones**: Propios de shadcn-admin-kit, no de react-admin

## 📝 Casos de Uso Implementados

### Campo "Usuario Responsable" en Facturas

**Requerimiento**: 
- Default al usuario loggeado
- Changeable via combo box
- Incluir en list como columna
- Incluir como filtro

**Implementación**:
- ✅ Backend: Campo `usuario_responsable_id` en modelo Factura
- ✅ Migración: Manual script siguiendo patrón del proyecto
- ✅ Frontend: Patrón oficial `defaultValues` en `<SimpleForm>`
- ✅ List: ReferenceField para mostrar usuario
- ✅ Filter: ReferenceInput para filtrar por usuario

## 🔄 Próximos Patrones a Documentar

Según el desarrollo del sistema, agregar:
- Validación de formularios
- Filtros avanzados
- Bulk actions
- Upload de archivos
- Relaciones many-to-many
- Dashboard widgets
- Custom layouts

---

**Nota**: Mantener este documento actualizado con cada patrón implementado siguiendo la documentación oficial de shadcn-admin-kit.

**Última actualización**: Septiembre 2025 - Campo Usuario Responsable en Facturas
