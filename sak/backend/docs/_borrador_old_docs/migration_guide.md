# Guía de Migración de Base de Datos

## Proceso para Agregar Nueva Entidad con Relaciones

### Caso de Estudio: Agregando Entidad User y Relación con Item

**Fecha**: 2025-08-31  
**Objetivo**: Agregar entidad User (nombre, telefono, email, urlFoto) y vincularlo con Item

## Pasos del Proceso

### 1. Creación del Modelo

1. Crear el archivo del modelo en `app/models/`
2. Definir la clase heredando de `Base`
3. Establecer campos y relaciones
4. Actualizar `__init__.py` para exportar el modelo

### 2. Migración de Base de Datos

1. Crear script de migración en `migrations/`
2. Ejecutar migración para crear nueva tabla
3. Poblar datos iniciales si es necesario
4. Actualizar relaciones existentes

### 3. Actualización del Router

1. Crear router genérico para la nueva entidad
2. Registrar en `main.py`
3. Verificar endpoints funcionando

### 4. Integración Frontend

1. Agregar resource en AdminApp.tsx
2. Crear componentes Create personalizados
3. Configurar ReferenceInput para relaciones
4. Agregar importaciones necesarias
5. Probar funcionalidad CRUD completa

**Componentes necesarios para relaciones:**
```tsx
import { ReferenceInput } from "@/components/reference-input";
import { AutocompleteInput } from "@/components/autocomplete-input";
```

**Patrón para relaciones:**
```tsx
<ReferenceInput source="entidad_id" reference="entidades" label="Entidad">
  <AutocompleteInput />
</ReferenceInput>
```

### 5. Verificación

1. Probar todas las operaciones CRUD
2. Verificar integridad referencial
3. Validar frontend muestra relaciones correctamente

## Comandos Importantes

```bash
# Backup de base de datos antes de migración
cp test.db test.db.backup

# Ejecutar migración
python migrations/001_add_user_entity.py

# Verificar estructura de BD
sqlite3 test.db ".schema"

# Verificar datos
sqlite3 test.db "SELECT * FROM users;"

# Iniciar backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Iniciar frontend
cd app_invoice && npm run dev
```

## Troubleshooting Frontend

### Error: "Failed to fetch"
**Síntoma**: TypeError en consola del navegador
**Causa**: Backend no está corriendo
**Solución**: 
1. Verificar que backend esté en http://127.0.0.1:8000
2. Comprobar CORS configurado correctamente
3. Revisar que ambos resources estén disponibles

### Error: ReferenceInput no funciona
**Síntoma**: Dropdown de usuario vacío
**Causa**: Resource referenciado no existe
**Solución**: Verificar que Resource "users" esté configurado antes que "items"

### Error: Campos no aparecen en ListGuesser
**Síntoma**: Columnas faltantes en tabla
**Causa**: Backend no retorna campos esperados
**Solución**: Verificar respuesta de API con herramientas de desarrollo

## Archivos Afectados

- `app/models/user.py` (nuevo)
- `app/models/__init__.py` (actualizado)
- `app/routers/user_router.py` (nuevo)
- `app/main.py` (actualizado)
- `migrations/001_add_user_entity.py` (nuevo)
- `app_invoice/app/admin/AdminApp.tsx` (actualizado)

## Notas Importantes

- Siempre hacer backup antes de migración
- Crear datos iniciales para mantener integridad referencial
- Probar en ambiente de desarrollo antes de producción
- Documentar cada cambio en este archivo
