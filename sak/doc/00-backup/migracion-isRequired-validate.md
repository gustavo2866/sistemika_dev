# Migración de isRequired a validate

## 📋 Contexto

Después de revisar la [documentación oficial de Shadcn Admin Kit](https://marmelab.com/shadcn-admin-kit/docs/textinput), se identificó que **`isRequired` NO es una prop estándar** de los componentes Input.

### ⚠️ Problema

El uso de `isRequired` genera warnings de React:
```
Warning: React does not recognize the `isRequired` prop on a DOM element
```

Esto ocurre porque `isRequired` no es filtrada correctamente y se pasa al DOM, donde no es un atributo HTML válido.

## ✅ Solución Oficial

Según la [documentación de SimpleForm - Validation](https://marmelab.com/shadcn-admin-kit/docs/simpleform#validation), la forma correcta de validar campos es usando la prop `validate` con validadores de `ra-core`.

### Patrón CORRECTO ✅

```tsx
import { required, email, minLength, maxLength, number } from "ra-core";

// Campo requerido simple
<TextInput 
  source="nombre" 
  label="Nombre" 
  validate={required()} 
  className="w-full" 
/>

// Email requerido con validación
<TextInput 
  source="email" 
  label="Email" 
  validate={[required(), email()]} 
  className="w-full" 
  type="email" 
/>

// Campo con múltiples validaciones
<TextInput 
  source="username" 
  label="Username" 
  validate={[required(), minLength(3), maxLength(20)]} 
  className="w-full" 
/>

// SelectInput requerido
<SelectInput
  source="categoria"
  label="Categoria"
  choices={categoriaChoices}
  validate={required()}
  className="w-full"
/>
```

### Patrón INCORRECTO ❌

```tsx
// NO USAR - isRequired no es una prop válida
<TextInput source="nombre" label="Nombre" isRequired className="w-full" />
<SelectInput source="categoria" choices={...} isRequired />
```

## 🔧 Validadores Disponibles

Importar desde `ra-core`:

```tsx
import { 
  required,      // Campo obligatorio
  email,         // Email válido
  minLength,     // Longitud mínima
  maxLength,     // Longitud máxima
  minValue,      // Valor mínimo (números)
  maxValue,      // Valor máximo (números)
  number,        // Número válido
  regex,         // Validación con expresión regular
  choices        // Valor dentro de una lista
} from "ra-core";
```

### Ejemplos de Uso

```tsx
// Campo requerido
validate={required()}

// Email válido y requerido
validate={[required(), email()]}

// Número entre 0 y 100
validate={[required(), number(), minValue(0), maxValue(100)]}

// Texto de 2 a 50 caracteres
validate={[required(), minLength(2), maxLength(50)]}

// DNI argentino (8 dígitos)
validate={[required(), regex(/^\d{8}$/, 'Debe ser un DNI válido de 8 dígitos')]}
```

## 📝 Plan de Migración

### Archivos COMPLETADOS ✅

- [x] `frontend/src/components/text-input.tsx` - Filtrado temporal de isRequired
- [x] `frontend/src/app/resources/nomina/form.tsx` - Migrado a validate
- [x] `frontend/src/app/resources/users/form.tsx` - Migrado a validate con email()
- [x] `frontend/src/app/resources/metodos-pago/form.tsx` - Migrado a validate
- [x] `frontend/src/app/resources/tipos-comprobante/form.tsx` - Migrado a validate
- [x] `frontend/src/app/resources/tipos-operacion/form.tsx` - Migrado a validate
- [x] `frontend/src/app/resources/proyectos/form.tsx` - Migrado a validate
- [x] `frontend/src/app/resources/propiedades/form.tsx` - Migrado a validate
- [x] `frontend/src/app/resources/proveedores/form.tsx` - Migrado a validate con email()
- [x] `frontend/src/app/resources/solicitudes/form.tsx` - Migrado a validate
- [x] `frontend/src/app/resources/solicitudes_mb/form.tsx` - Migrado a validate
- [x] `frontend/src/app/resources/facturas/form.tsx` - Migrado a validate
- [x] `frontend/src/app/resources/articulos/form.tsx` - Migrado a validate

### ✅ Migración COMPLETADA

**Total de archivos migrados**: 13/13 ✅  
**Estado**: COMPLETADO - Todos los formularios ahora usan el patrón oficial `validate={required()}`

## 🎯 Pasos para Migrar un Formulario

1. **Agregar import** de validadores necesarios:
   ```tsx
   import { required, email } from "ra-core";
   ```

2. **Reemplazar** `isRequired` por `validate={required()}`:
   ```diff
   - <TextInput source="nombre" label="Nombre" isRequired />
   + <TextInput source="nombre" label="Nombre" validate={required()} />
   ```

3. **Para emails**, agregar validador adicional:
   ```diff
   - <TextInput source="email" type="email" isRequired />
   + <TextInput source="email" type="email" validate={[required(), email()]} />
   ```

4. **Para ReferenceInput**:
   ```diff
   - <ReferenceInput source="proveedor_id" reference="proveedores" isRequired>
   + <ReferenceInput source="proveedor_id" reference="proveedores" validate={required()}>
   ```

5. **Probar** el formulario para verificar que la validación funciona

## 🔍 Verificación

Después de migrar, verificar que:

1. ✅ No aparecen warnings en consola sobre `isRequired`
2. ✅ Los campos requeridos muestran error si están vacíos
3. ✅ El formulario no se envía si hay errores de validación
4. ✅ Los mensajes de error son claros y en español (si se configuraron traducciones)

## 📚 Referencias

- [TextInput - Documentación Oficial](https://marmelab.com/shadcn-admin-kit/docs/textinput)
- [SimpleForm Validation - Documentación Oficial](https://marmelab.com/shadcn-admin-kit/docs/simpleform#validation)
- [ra-core Validators](https://marmelab.com/ra-core/validation/)

## ⚠️ Nota Importante

El filtrado de `isRequired` en `text-input.tsx` se mantiene como medida de compatibilidad, pero **ya no es necesario** porque todos los formularios han sido migrados al patrón oficial `validate`.

### 🎯 Próximos Pasos (Opcionales)

1. ✅ **COMPLETADO**: Migrar todos los formularios a `validate`
2. 🔄 **Opcional**: Remover el filtrado de `isRequired` en `text-input.tsx` (ya no genera warnings)
3. 🔄 **Opcional**: Agregar validaciones adicionales donde sea necesario:
   - `minLength`, `maxLength` para textos
   - `minValue`, `maxValue` para números
   - `regex` para formatos específicos (DNI, CUIT, etc.)

---

**Fecha de creación**: 18 de octubre de 2025  
**Fecha de completación**: 18 de octubre de 2025  
**Estado**: ✅ **COMPLETADO** - 13/13 archivos migrados
