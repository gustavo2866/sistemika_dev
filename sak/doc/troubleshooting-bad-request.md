# Troubleshooting: HttpError Bad Request

## 🔍 Diagnóstico del Error

**Error**: `HttpError: Bad Request` en consola del navegador  
**Ubicación**: `ra-core/dist/esm`  
**Fecha**: 18 de octubre de 2025

## ✅ Verificaciones Realizadas

1. ✅ **Backend funcionando**: Endpoints `/nominas` y `/users` responden correctamente
2. ✅ **Migración completada**: Todos los formularios usan `validate={required()}`
3. ✅ **Compilación exitosa**: No hay errores de TypeScript
4. ⚠️ **Error en tiempo de ejecución**: Bad Request indica problema de validación o datos

## 🎯 Causas Comunes del Error "Bad Request"

### 1. Campos Requeridos Faltantes
El backend espera campos obligatorios que no se están enviando.

**Solución**: Verificar que `validate={required()}` esté en todos los campos obligatorios del modelo backend.

### 2. Tipo de Datos Incorrecto
El frontend envía un tipo de dato que el backend no acepta (ej: string en lugar de number).

**Solución**: 
- Para fechas: usar `type="date"` en TextInput
- Para números: usar `NumberInput` en lugar de TextInput
- Para booleanos: usar `BooleanInput`

### 3. Valores por Defecto Incorrectos
BooleanInput con `defaultValue` sin valor específico.

**Solución**: Usar `defaultValue={true}` o `defaultValue={false}` explícitamente.

### 4. Validación de SelectInput/ReferenceInput
SelectInput dentro de ReferenceInput con `validate` puede causar problemas.

**Solución**: 
```tsx
// ✅ Correcto
<ReferenceInput source="proveedor_id" reference="proveedores">
  <SelectInput optionText="nombre" validate={required()} />
</ReferenceInput>

// ❌ Incorrecto
<ReferenceInput source="proveedor_id" reference="proveedores" validate={required()}>
  <SelectInput optionText="nombre" />
</ReferenceInput>
```

## 📋 Pasos para Diagnosticar

### Paso 1: Identificar el Recurso Afectado
¿En qué pantalla ocurre el error?
- [ ] Nómina
- [ ] Users
- [ ] Facturas
- [ ] Proveedores
- [ ] Otros: __________

### Paso 2: Identificar la Acción
¿Qué acción causa el error?
- [ ] Crear nuevo registro (Create)
- [ ] Editar registro existente (Edit)
- [ ] Listar registros (List)
- [ ] Ver detalles (Show)

### Paso 3: Revisar Request/Response
Abrir **DevTools → Network** y capturar:

1. **Request Payload** (datos enviados):
```json
{
  "nombre": "...",
  "apellido": "...",
  // ... otros campos
}
```

2. **Response** (respuesta del servidor):
```json
{
  "detail": [
    {
      "loc": ["body", "campo"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### Paso 4: Verificar Modelo Backend
Comparar campos requeridos en el modelo con los enviados desde el frontend.

**Ejemplo Nómina**:
```python
# Backend - campos requeridos
nombre: str  # ✅ Requerido
apellido: str  # ✅ Requerido
dni: str  # ✅ Requerido
categoria: CategoriaNomina  # ✅ Requerido (tiene default)
email: Optional[str]  # ⚠️ Opcional
```

```tsx
// Frontend - debe coincidir
<TextInput source="nombre" validate={required()} />
<TextInput source="apellido" validate={required()} />
<TextInput source="dni" validate={required()} />
<SelectInput source="categoria" validate={required()} />
<TextInput source="email" />  {/* Sin required - es opcional */}
```

## 🔧 Soluciones Aplicadas

### Corrección 1: BooleanInput defaultValue
**Archivo**: `frontend/src/app/resources/nomina/form.tsx`

```tsx
// ❌ Antes
<BooleanInput source="activo" defaultValue />

// ✅ Después
<BooleanInput source="activo" defaultValue={true} />
```

## 📊 Estado Actual

- ✅ Backend funcionando
- ✅ Endpoints respondiendo
- ⚠️ Error "Bad Request" en frontend
- 🔄 Esperando detalles del error para diagnóstico específico

## 🚀 Próximos Pasos

1. **Capturar datos completos del error** en DevTools Network
2. **Identificar el recurso específico** que falla
3. **Comparar Request/Response** con modelo backend
4. **Ajustar validación** según sea necesario

## 📝 Información Adicional Requerida

Por favor proporciona:

1. ¿En qué pantalla/recurso estás cuando aparece el error?
2. ¿Qué datos estás intentando crear/editar?
3. Captura de pantalla de DevTools → Network → Request/Response
4. ¿El error ocurre siempre o solo con ciertos datos?

---

**Última actualización**: 18 de octubre de 2025
