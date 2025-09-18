# Referencias de Documentación shadcn-admin-kit

## 📚 Enlaces Principales

### Documentación Base
- [Instalación](https://marmelab.com/shadcn-admin-kit/docs/install)
- [Quick Start Guide](https://marmelab.com/shadcn-admin-kit/docs/quick-start-guide)
- [Repositorio GitHub](https://github.com/marmelab/shadcn-admin-kit)

### CRUD Pages
- [Create](https://marmelab.com/shadcn-admin-kit/docs/create) ⭐ **Consultado**
- [Edit](https://marmelab.com/shadcn-admin-kit/docs/edit)
- [Show](https://marmelab.com/shadcn-admin-kit/docs/show)
- [List](https://marmelab.com/shadcn-admin-kit/docs/list)

### Forms
- [SimpleForm](https://marmelab.com/shadcn-admin-kit/docs/simpleform) ⭐ **Consultado**
- [Form Validation](https://marmelab.com/shadcn-admin-kit/docs/simpleform#validation)

### Inputs
- [ReferenceInput](https://marmelab.com/shadcn-admin-kit/docs/referenceinput) ⭐ **Consultado**
- [SelectInput](https://marmelab.com/shadcn-admin-kit/docs/selectinput)
- [TextInput](https://marmelab.com/shadcn-admin-kit/docs/textinput)
- [NumberInput](https://marmelab.com/shadcn-admin-kit/docs/numberinput)
- [BooleanInput](https://marmelab.com/shadcn-admin-kit/docs/booleaninput)
- [AutocompleteInput](https://marmelab.com/shadcn-admin-kit/docs/autocompleteinput)

### Fields (Display)
- [ReferenceField](https://marmelab.com/shadcn-admin-kit/docs/referencefield)
- [TextField](https://marmelab.com/shadcn-admin-kit/docs/textfield)
- [NumberField](https://marmelab.com/shadcn-admin-kit/docs/numberfield)
- [DateField](https://marmelab.com/shadcn-admin-kit/docs/datefield)

### Data Table
- [DataTable](https://marmelab.com/shadcn-admin-kit/docs/datatable)
- [ListPagination](https://marmelab.com/shadcn-admin-kit/docs/listpagination)

### Security
- [Auth Providers](https://marmelab.com/shadcn-admin-kit/docs/security)

### UI Components
- [Layout](https://marmelab.com/shadcn-admin-kit/docs/layout)
- [AppSidebar](https://marmelab.com/shadcn-admin-kit/docs/appsidebar)
- [Breadcrumb](https://marmelab.com/shadcn-admin-kit/docs/breadcrumb)

## 🔍 Enlaces Consultados en Este Desarrollo

### Para Campo "Usuario Responsable"
1. **Create Component**: https://marmelab.com/shadcn-admin-kit/docs/create
   - Props: `record`, `defaultValues`, `redirect`, `title`
   - Patrón para inicializar formularios

2. **SimpleForm Component**: https://marmelab.com/shadcn-admin-kit/docs/simpleform
   - Sección "Default Values": https://marmelab.com/shadcn-admin-kit/docs/simpleform#default-values
   - Patrón oficial: `defaultValues` prop

3. **ReferenceInput Component**: https://marmelab.com/shadcn-admin-kit/docs/referenceinput
   - Para relaciones foreign key
   - Usage con SelectInput

4. **GitHub Repository**: https://github.com/marmelab/shadcn-admin-kit
   - Tech Stack
   - Examples y structure

## 📋 Patrón de Consulta Recomendado

Para cada nueva funcionalidad:

1. **Primero**: Consultar documentación oficial de shadcn-admin-kit (NO react-admin)
2. **Segundo**: Ver ejemplos en el repositorio GitHub
3. **Tercero**: Documentar el patrón implementado en este archivo
4. **Cuarto**: Actualizar `shadcn-admin-kit-patterns.md` con el caso de uso

## ⚠️ Errores Comunes a Evitar

1. **NO consultar react-admin**: shadcn-admin-kit tiene sus propios patrones
2. **NO usar Material-UI**: shadcn-admin-kit usa shadcn/ui + Tailwind
3. **NO usar patrones obsoletos**: Siempre consultar la documentación más reciente
4. **NO mezclar paradigmas**: Usar consistentemente los patrones de shadcn-admin-kit

---

**Nota**: Marcar con ⭐ los enlaces consultados y agregar fecha de consulta.
