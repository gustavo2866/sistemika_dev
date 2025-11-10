# Instructivo CRUD Genérico - Sistema SAK

## 📋 Índice
1. [Introducción](#introducción)
2. [Estructura del Patrón CRUD](#estructura-del-patrón-crud)
3. [Backend - Paso a Paso](#backend---paso-a-paso)
4. [Frontend - Paso a Paso](#frontend---paso-a-paso)
5. [Casos Especiales](#casos-especiales)
6. [Checklist de Verificación](#checklist-de-verificación)
7. [Ejemplos de Referencia](#ejemplos-de-referencia)

---

## Introducción

Este instructivo documenta el patrón estándar para crear entidades CRUD en el sistema SAK, basado en la implementación de **Tareas** y siguiendo los patrones oficiales de **shadcn-admin-kit**.

### 🎯 Patrón Genérico Identificado

**Backend**: FastAPI + SQLModel + Generic CRUD
**Frontend**: Next.js + shadcn-admin-kit + React Hook Form
**Base de Datos**: SQLite con timestamps automáticos y soft delete

---

## Estructura del Patrón CRUD

### 📁 Estructura de Archivos (Backend)
```
server/app/
├── models/
│   └── nueva_entidad.py         # Modelo SQLModel
├── routers/
│   └── nueva_entidad_router.py  # Router genérico
├── migrations/                  # Scripts de migración manual
│   └── XXX_add_nueva_entidad.py
└── main.py                      # Registro del router
```

### 📁 Estructura de Archivos (Frontend)
```
app_invoice/app/resources/nueva_entidad/
├── index.ts                     # Exports
├── config.ts                    # Configuración del recurso
├── form.tsx                     # Formulario compartido
├── create.tsx                   # Página de creación
├── edit.tsx                     # Página de edición
├── list.tsx                     # Página de listado
└── show.tsx                     # Página de detalle
```

---

## Backend - Paso a Paso

### 1. Crear el Modelo

**Archivo**: `server/app/models/nueva_entidad.py`

```python
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from app.models.base import Base

# TYPE_CHECKING para evitar imports circulares
if TYPE_CHECKING:
    from app.models.user import User

class NuevaEntidad(Base, table=True):
    """Modelo para [descripción de la entidad]"""
    __tablename__ = "nueva_entidad"
    
    # Metadata para CRUD
    __searchable_fields__ = ["campo1", "campo2"]  # Campos para búsqueda de texto
    
    # Campos de negocio
    campo1: str = Field(max_length=200, description="Descripción del campo")
    campo2: Optional[str] = Field(default=None, description="Campo opcional")
    estado: str = Field(default="activo", max_length=50)
    
    # Foreign Keys (si aplica)
    user_id: int = Field(foreign_key="users.id", description="Usuario relacionado")
    
    # Relationships (si aplica)
    user: "User" = Relationship(back_populates="nueva_entidades")
    
    def __str__(self) -> str:
        return f"NuevaEntidad(id={self.id}, campo1='{self.campo1}')"
```

### 2. Crear el Router

**Archivo**: `server/app/routers/nueva_entidad_router.py`

```python
from app.models.nueva_entidad import NuevaEntidad
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD genérico
nueva_entidad_crud = GenericCRUD(NuevaEntidad)

# Crear router genérico
nueva_entidad_router = create_generic_router(
    model=NuevaEntidad,
    crud=nueva_entidad_crud,
    prefix="/nueva-entidades",  # En plural y kebab-case
    tags=["nueva-entidades"]
)
```

### 3. Registrar el Router

**Archivo**: `server/app/routers/__init__.py`
```python
# Agregar import
from .nueva_entidad_router import nueva_entidad_router

# Agregar a __all__
__all__ = [
    # ... otros routers
    "nueva_entidad_router",
]
```

**Archivo**: `server/app/main.py`
```python
# Agregar import
from app.routers.nueva_entidad_router import nueva_entidad_router

# Agregar router a la app
app.include_router(nueva_entidad_router)
```

### 4. Actualizar Models Package

**Archivo**: `server/app/models/__init__.py`
```python
# Agregar import
from .nueva_entidad import NuevaEntidad

# Agregar a __all__
__all__ = [
    # ... otros modelos
    "NuevaEntidad",
]
```

### 5. Crear Migración

**Archivo**: `server/migrations/XXX_add_nueva_entidad.py`
```python
#!/usr/bin/env python3
"""
Migración: Agregar tabla nueva_entidad
Fecha: [fecha actual]
Descripción: Crea la tabla nueva_entidad con campos básicos
"""

import sqlite3
import os
from datetime import datetime

def migrate():
    # Ruta a la base de datos
    db_path = os.path.join(os.path.dirname(__file__), "..", "database.db")
    
    # Verificar que existe la DB
    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Crear tabla
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS nueva_entidad (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campo1 VARCHAR(200) NOT NULL,
                campo2 TEXT,
                estado VARCHAR(50) DEFAULT 'activo',
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                version INTEGER DEFAULT 1,
                deleted_at TIMESTAMP NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        # Insertar datos de ejemplo (opcional)
        cursor.execute("""
            INSERT INTO nueva_entidad (campo1, campo2, user_id) 
            VALUES (?, ?, ?)
        """, ("Ejemplo 1", "Descripción ejemplo", 1))
        
        conn.commit()
        count = cursor.rowcount
        
        print(f"✅ Migración completada: {count} registros afectados")
        return True
        
    except Exception as e:
        print(f"❌ Error en migración: {e}")
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
```

---

## Frontend - Paso a Paso

### 1. Configuración del Recurso

**Archivo**: `app/resources/nueva_entidad/config.ts`
```typescript
export const nuevaEntidadConfig = {
  name: "nueva-entidades",  // Debe coincidir con el backend
  label: "Nueva Entidad",
  labelPlural: "Nuevas Entidades"
};
```

### 2. Crear Formulario Compartido

**Archivo**: `app/resources/nueva_entidad/form.tsx`
```tsx
"use client";

import { TextInput } from "@/components/text-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";

type Mode = "create" | "edit";
type NuevaEntidadValues = {
  campo1: string;
  campo2?: string;
  estado: string;
  user_id: number;
};

const READ_ONLY_ON_EDIT = new Set<keyof NuevaEntidadValues>([
  // Campos que no se pueden editar después de crear
]);

export function NuevaEntidadFields({ mode }: { mode: Mode }) {
  const isEdit = mode === "edit";
  const ro = (name: keyof NuevaEntidadValues) => isEdit && READ_ONLY_ON_EDIT.has(name);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información de la Nueva Entidad</CardTitle>
          <CardDescription>
            Datos básicos de la entidad
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextInput 
            source="campo1" 
            label="Campo 1" 
            required 
            disabled={ro("campo1")}
            placeholder="Ingrese el valor"
          />
          
          <TextInput 
            source="campo2" 
            label="Campo 2" 
            disabled={ro("campo2")}
            placeholder="Descripción opcional"
          />
          
          <SelectInput 
            source="estado" 
            label="Estado"
            isRequired
            choices={[
              { id: "activo", name: "Activo" },
              { id: "inactivo", name: "Inactivo" },
            ]}
          />
          
          <ReferenceInput 
            source="user_id" 
            reference="users"
            label="Usuario Responsable"
          >
            <SelectInput />
          </ReferenceInput>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 3. Crear Página de Creación

**Archivo**: `app/resources/nueva_entidad/create.tsx`
```tsx
"use client";

import { Create } from "@/components/create";
import { SimpleForm } from "@/components/simple-form";
import { NuevaEntidadFields } from "./form";
import { useGetIdentity } from "ra-core";

export const NuevaEntidadCreate = () => {
  const { identity } = useGetIdentity();

  // Valores por defecto usando patrón oficial shadcn-admin-kit
  const defaultValues = {
    estado: "activo",
    user_id: identity?.id
  };

  return (
    <Create redirect="list" title="Crear Nueva Entidad">
      <SimpleForm defaultValues={defaultValues}>
        <NuevaEntidadFields mode="create" />
      </SimpleForm>
    </Create>
  );
};
```

### 4. Crear Página de Edición

**Archivo**: `app/resources/nueva_entidad/edit.tsx`
```tsx
"use client";

import { Edit } from "@/components/edit";
import { SimpleForm } from "@/components/simple-form";
import { NuevaEntidadFields } from "./form";

export const NuevaEntidadEdit = () => (
  <Edit title="Editar Nueva Entidad">
    <SimpleForm>
      <NuevaEntidadFields mode="edit" />
    </SimpleForm>
  </Edit>
);
```

### 5. Crear Página de Listado

**Archivo**: `app/resources/nueva_entidad/list.tsx`
```tsx
"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { EditButton } from "@/components/edit-button";
import { TextInput } from "@/components/text-input";
import { ReferenceField } from "@/components/reference-field";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { BadgeField } from "@/components/badge-field";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar..." alwaysOn />,
  <TextInput key="campo1" source="campo1" label="Campo 1" />,
  <SelectInput key="estado" source="estado" label="Estado" choices={[
    { id: 'activo', name: 'Activo' },
    { id: 'inactivo', name: 'Inactivo' }
  ]} />,
  <ReferenceInput key="user_id" source="user_id" reference="users" label="Usuario">
    <SelectInput />
  </ReferenceInput>,
];

export const NuevaEntidadList = () => (
  <List filters={filters}>
    <DataTable>
      <DataTable.Col source="id" />
      <DataTable.Col source="campo1" />
      <DataTable.Col source="campo2" />
      <DataTable.Col source="estado">
        <BadgeField />
      </DataTable.Col>
      <DataTable.Col source="user_id" label="Usuario">
        <ReferenceField reference="users">
          <TextField source="nombre" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col label="Acciones">
        <EditButton />
      </DataTable.Col>
    </DataTable>
  </List>
);
```

### 6. Crear Página de Detalle

**Archivo**: `app/resources/nueva_entidad/show.tsx`
```tsx
"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { BadgeField } from "@/components/badge-field";

export const NuevaEntidadShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="campo1" />
      <TextField source="campo2" />
      <BadgeField source="estado" />
      <ReferenceField source="user_id" reference="users">
        <TextField source="nombre" />
      </ReferenceField>
      <TextField source="created_at" />
      <TextField source="updated_at" />
    </SimpleShowLayout>
  </Show>
);
```

### 7. Crear Index de Exports

**Archivo**: `app/resources/nueva_entidad/index.ts`
```typescript
export { NuevaEntidadList } from "./list";
export { NuevaEntidadFields } from "./form";
export { NuevaEntidadCreate } from "./create";
export { NuevaEntidadEdit } from "./edit";
export { NuevaEntidadShow } from "./show";
export { nuevaEntidadConfig } from "./config";
```

### 8. Registrar en Resources

**Archivo**: `app/resources/index.ts`
```typescript
// Agregar export
export * from "./nueva_entidad";
```

### 9. Registrar en AdminApp

**Archivo**: `app/admin/AdminApp.tsx`
```tsx
// Agregar import
import {
  NuevaEntidadCreate, NuevaEntidadEdit, 
  NuevaEntidadList, NuevaEntidadShow
} from "../resources";

// Agregar Resource
<Resource
  name="nueva-entidades"
  list={NuevaEntidadList}
  create={NuevaEntidadCreate}
  edit={NuevaEntidadEdit}
  show={NuevaEntidadShow}
/>
```

---

## Casos Especiales

### 1. Endpoints Adicionales al CRUD Estándar

Cuando necesites endpoints adicionales (como procesamiento especial, reportes, etc.):

**Backend**: `server/app/routers/nueva_entidad_router.py`
```python
from fastapi import HTTPException
from app.models.nueva_entidad import NuevaEntidad
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# CRUD genérico estándar
nueva_entidad_crud = GenericCRUD(NuevaEntidad)
nueva_entidad_router = create_generic_router(
    model=NuevaEntidad,
    crud=nueva_entidad_crud,
    prefix="/nueva-entidades",
    tags=["nueva-entidades"]
)

# ENDPOINTS ADICIONALES
@nueva_entidad_router.post("/{id}/procesar")
def procesar_entidad(
    id: int,
    session: Session = Depends(get_session)
):
    """Endpoint adicional para procesamiento especial"""
    entidad = nueva_entidad_crud.get(session, id)
    if not entidad:
        raise HTTPException(status_code=404, detail="Entidad no encontrada")
    
    # Lógica de procesamiento específica
    entidad.estado = "procesada"
    session.add(entidad)
    session.commit()
    session.refresh(entidad)
    
    return {"message": "Entidad procesada", "data": entidad}

@nueva_entidad_router.get("/estadisticas")
def obtener_estadisticas(session: Session = Depends(get_session)):
    """Endpoint para estadísticas"""
    total = session.exec(select(func.count(NuevaEntidad.id))).first()
    activos = session.exec(
        select(func.count(NuevaEntidad.id))
        .where(NuevaEntidad.estado == "activo")
    ).first()
    
    return {
        "total": total,
        "activos": activos,
        "inactivos": total - activos
    }
```

### 2. Relaciones Complejas

**Many-to-Many**: Usar tablas intermedias
```python
# En el modelo
class NuevaEntidadTag(SQLModel, table=True):
    nueva_entidad_id: int = Field(foreign_key="nueva_entidad.id", primary_key=True)
    tag_id: int = Field(foreign_key="tags.id", primary_key=True)

class NuevaEntidad(Base, table=True):
    # ... otros campos
    tags: List["Tag"] = Relationship(
        back_populates="nueva_entidades",
        link_model=NuevaEntidadTag
    )
```

### 3. Validaciones Personalizadas

**En el modelo**:
```python
from sqlmodel import Field, validator

class NuevaEntidad(Base, table=True):
    email: str = Field(...)
    
    @validator('email')
    def validate_email(cls, v):
        if '@' not in v:
            raise ValueError('Email inválido')
        return v
```

### 4. Campos Calculados

**En el frontend**:
```tsx
// En list.tsx
<DataTable.Col source="campo_calculado" label="Campo Calculado">
  <FunctionField render={(record) => 
    `${record.campo1} - ${record.campo2}`
  } />
</DataTable.Col>
```

---

## Checklist de Verificación

### ✅ Backend
- [ ] Modelo creado en `models/nueva_entidad.py`
- [ ] Router creado en `routers/nueva_entidad_router.py`
- [ ] Router registrado en `main.py`
- [ ] Modelo exportado en `models/__init__.py`
- [ ] Router exportado en `routers/__init__.py`
- [ ] Migración creada y ejecutada
- [ ] Endpoints probados en Swagger (`/docs`)

### ✅ Frontend
- [ ] Configuración en `config.ts`
- [ ] Formulario en `form.tsx`
- [ ] Páginas CRUD creadas (create, edit, list, show)
- [ ] Exports en `index.ts`
- [ ] Registrado en `resources/index.ts`
- [ ] Resource agregado en `AdminApp.tsx`
- [ ] Navegación funcional

### ✅ Funcionalidad
- [ ] Crear nuevo registro
- [ ] Editar registro existente
- [ ] Listar con paginación
- [ ] Filtros funcionando
- [ ] Búsqueda de texto
- [ ] Relaciones (ReferenceField/ReferenceInput)
- [ ] Validaciones frontend y backend
- [ ] Redirecciones correctas

---

## Ejemplos de Referencia

### 📋 Entidades Implementadas para Consultar

1. **Tareas** (`/tareas`)
   - **Backend**: `server/app/models/tarea.py` + `server/app/routers/tarea_router.py`
   - **Frontend**: `app/resources/tareas/`
   - **Patrón**: CRUD básico con relación a Usuario

2. **Usuarios** (`/users`)
   - **Backend**: `server/app/models/user.py` + `server/app/routers/user_router.py`
   - **Frontend**: `app/resources/users/`
   - **Patrón**: Entidad base del sistema

3. **Facturas** (`/facturas`)
   - **Backend**: `server/app/models/factura.py` + `server/app/routers/factura_router.py`
   - **Frontend**: `app/resources/facturas/`
   - **Patrón**: CRUD con valores por defecto (usuario responsable)

### 🔗 Enlaces de Documentación

- **shadcn-admin-kit Patterns**: `doc/shadcn-admin-kit-patterns.md`
- **shadcn-admin-kit References**: `doc/shadcn-admin-kit-references.md`
- **Backend Implementation Log**: `server/docs/implementation_log.md`

---

## 📝 Notas Finales

1. **Consistencia**: Siempre seguir este patrón para mantener consistencia
2. **Nomenclatura**: Usar kebab-case en URLs y snake_case en base de datos
3. **shadcn-admin-kit**: Seguir patrones oficiales, NO react-admin
4. **Documentación**: Actualizar este instructivo con nuevos patrones identificados

**Última actualización**: Septiembre 2025 - Basado en implementación de Tareas y Facturas
