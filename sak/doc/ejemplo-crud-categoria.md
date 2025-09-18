# Ejemplo Práctico: Entidad "Categoria"

Este archivo muestra un ejemplo completo de implementación siguiendo el instructivo CRUD genérico.

## 🎯 Definición de la Entidad

**Entidad**: Categoria
**Propósito**: Categorizar productos/items del sistema
**Relaciones**: Pertenece a un Usuario (creator)

## 📄 Archivos Implementados

### Backend

#### 1. Modelo: `server/app/models/categoria.py`
```python
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User

class Categoria(Base, table=True):
    """Modelo para categorías del sistema"""
    __tablename__ = "categorias"
    
    # Metadata para CRUD
    __searchable_fields__ = ["nombre", "descripcion"]
    
    # Campos de negocio
    nombre: str = Field(max_length=100, description="Nombre de la categoría")
    descripcion: Optional[str] = Field(default=None, description="Descripción de la categoría")
    codigo: Optional[str] = Field(default=None, max_length=20, description="Código único")
    activa: bool = Field(default=True, description="Estado de la categoría")
    color: Optional[str] = Field(default="#3B82F6", max_length=7, description="Color hexadecimal")
    
    # Relación con Usuario creador
    user_id: int = Field(foreign_key="users.id", description="Usuario que creó la categoría")
    user: "User" = Relationship(back_populates="categorias")
    
    def __str__(self) -> str:
        return f"Categoria(id={self.id}, nombre='{self.nombre}', activa={self.activa})"
```

#### 2. Router: `server/app/routers/categoria_router.py`
```python
from app.models.categoria import Categoria
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

# Crear CRUD genérico
categoria_crud = GenericCRUD(Categoria)

# Crear router genérico
categoria_router = create_generic_router(
    model=Categoria,
    crud=categoria_crud,
    prefix="/categorias",
    tags=["categorias"]
)
```

#### 3. Migración: `server/migrations/20250917_add_categorias.py`
```python
#!/usr/bin/env python3
"""
Migración: Agregar tabla categorias
Fecha: 2025-09-17
Descripción: Crea la tabla categorias para organizar productos
"""

import sqlite3
import os
from datetime import datetime

def migrate():
    # Ruta a la base de datos
    db_path = os.path.join(os.path.dirname(__file__), "..", "database.db")
    
    if not os.path.exists(db_path):
        print(f"❌ Base de datos no encontrada: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Crear tabla categorias
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categorias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre VARCHAR(100) NOT NULL,
                descripcion TEXT,
                codigo VARCHAR(20) UNIQUE,
                activa BOOLEAN DEFAULT 1,
                color VARCHAR(7) DEFAULT '#3B82F6',
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                version INTEGER DEFAULT 1,
                deleted_at TIMESTAMP NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        # Insertar categorías de ejemplo
        categorias_ejemplo = [
            ("Electrónicos", "Dispositivos y equipos electrónicos", "ELEC", "#8B5CF6", 1),
            ("Hogar", "Artículos para el hogar", "HOME", "#10B981", 1),
            ("Oficina", "Suministros de oficina", "OFIC", "#F59E0B", 1),
            ("Herramientas", "Herramientas y equipos", "TOOL", "#EF4444", 1)
        ]
        
        cursor.executemany("""
            INSERT INTO categorias (nombre, descripcion, codigo, color, user_id) 
            VALUES (?, ?, ?, ?, ?)
        """, categorias_ejemplo)
        
        conn.commit()
        count = cursor.rowcount
        
        print(f"✅ Migración completada: {count} categorías creadas")
        return True
        
    except Exception as e:
        print(f"❌ Error en migración: {e}")
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
```

### Frontend

#### 4. Config: `app/resources/categorias/config.ts`
```typescript
export const categoriaConfig = {
  name: "categorias",
  label: "Categoría",
  labelPlural: "Categorías"
};
```

#### 5. Form: `app/resources/categorias/form.tsx`
```tsx
"use client";

import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";

type Mode = "create" | "edit";
type CategoriaValues = {
  nombre: string;
  descripcion?: string;
  codigo?: string;
  activa: boolean;
  color?: string;
  user_id: number;
};

const READ_ONLY_ON_EDIT = new Set<keyof CategoriaValues>([
  "codigo", // El código no se puede cambiar después de crear
]);

export function CategoriaFields({ mode }: { mode: Mode }) {
  const isEdit = mode === "edit";
  const ro = (name: keyof CategoriaValues) => isEdit && READ_ONLY_ON_EDIT.has(name);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Información de la Categoría
          </CardTitle>
          <CardDescription>
            Datos básicos de la categoría
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput 
              source="nombre" 
              label="Nombre" 
              required 
              disabled={ro("nombre")}
              placeholder="Ej: Electrónicos"
              helperText="Nombre de la categoría"
            />
            
            <TextInput 
              source="codigo" 
              label="Código" 
              disabled={ro("codigo")}
              placeholder="Ej: ELEC"
              helperText="Código único (opcional)"
            />
          </div>
          
          <TextInput 
            source="descripcion" 
            label="Descripción" 
            disabled={ro("descripcion")}
            placeholder="Descripción de la categoría"
            helperText="Descripción detallada"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput 
              source="color" 
              label="Color" 
              type="color"
              disabled={ro("color")}
              helperText="Color para identificar la categoría"
            />
            
            <div className="flex items-center space-x-2">
              <BooleanInput 
                source="activa" 
                label="Categoría Activa"
                disabled={ro("activa")}
              />
            </div>
          </div>
          
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

#### 6. Create: `app/resources/categorias/create.tsx`
```tsx
"use client";

import { Create } from "@/components/create";
import { SimpleForm } from "@/components/simple-form";
import { CategoriaFields } from "./form";
import { useGetIdentity } from "ra-core";

export const CategoriaCreate = () => {
  const { identity } = useGetIdentity();

  const defaultValues = {
    activa: true,
    color: "#3B82F6",
    user_id: identity?.id
  };

  return (
    <Create redirect="list" title="Crear Categoría">
      <SimpleForm defaultValues={defaultValues}>
        <CategoriaFields mode="create" />
      </SimpleForm>
    </Create>
  );
};
```

#### 7. Edit: `app/resources/categorias/edit.tsx`
```tsx
"use client";

import { Edit } from "@/components/edit";
import { SimpleForm } from "@/components/simple-form";
import { CategoriaFields } from "./form";

export const CategoriaEdit = () => (
  <Edit title="Editar Categoría">
    <SimpleForm>
      <CategoriaFields mode="edit" />
    </SimpleForm>
  </Edit>
);
```

#### 8. List: `app/resources/categorias/list.tsx`
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
import { BooleanField } from "@/components/boolean-field";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar categorías..." alwaysOn />,
  <TextInput key="nombre" source="nombre" label="Nombre" />,
  <TextInput key="codigo" source="codigo" label="Código" />,
  <SelectInput key="activa" source="activa" label="Estado" choices={[
    { id: true, name: 'Activa' },
    { id: false, name: 'Inactiva' }
  ]} />,
  <ReferenceInput key="user_id" source="user_id" reference="users" label="Usuario">
    <SelectInput />
  </ReferenceInput>,
];

export const CategoriaList = () => (
  <List filters={filters}>
    <DataTable>
      <DataTable.Col source="id" />
      <DataTable.Col source="nombre" />
      <DataTable.Col source="codigo" />
      <DataTable.Col source="descripcion" />
      <DataTable.Col source="activa" label="Estado">
        <BooleanField />
      </DataTable.Col>
      <DataTable.Col source="color" label="Color">
        <div style={{ 
          width: '20px', 
          height: '20px', 
          borderRadius: '4px',
          backgroundColor: 'var(--value)',
          border: '1px solid #ccc'
        }} />
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

#### 9. Show: `app/resources/categorias/show.tsx`
```tsx
"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { BadgeField } from "@/components/badge-field";
import { BooleanField } from "@/components/boolean-field";

export const CategoriaShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="nombre" />
      <TextField source="codigo" />
      <TextField source="descripcion" />
      <BooleanField source="activa" />
      <TextField source="color" />
      <ReferenceField source="user_id" reference="users">
        <TextField source="nombre" />
      </ReferenceField>
      <TextField source="created_at" />
      <TextField source="updated_at" />
    </SimpleShowLayout>
  </Show>
);
```

#### 10. Index: `app/resources/categorias/index.ts`
```typescript
export { CategoriaList } from "./list";
export { CategoriaFields } from "./form";
export { CategoriaCreate } from "./create";
export { CategoriaEdit } from "./edit";
export { CategoriaShow } from "./show";
export { categoriaConfig } from "./config";
```

## 🔧 Archivos de Registro

### Backend Registrations

#### `server/app/models/__init__.py`
```python
# Agregar
from .categoria import Categoria

__all__ = [
    # ... otros modelos
    "Categoria",
]
```

#### `server/app/routers/__init__.py`
```python
# Agregar
from .categoria_router import categoria_router

__all__ = [
    # ... otros routers
    "categoria_router",
]
```

#### `server/app/main.py`
```python
# Agregar import
from app.routers.categoria_router import categoria_router

# Agregar router
app.include_router(categoria_router)
```

### Frontend Registrations

#### `app/resources/index.ts`
```typescript
// Agregar
export * from "./categorias";
```

#### `app/admin/AdminApp.tsx`
```tsx
// Agregar import
import {
  CategoriaCreate, CategoriaEdit, 
  CategoriaList, CategoriaShow
} from "../resources";

// Agregar Resource
<Resource
  name="categorias"
  list={CategoriaList}
  create={CategoriaCreate}
  edit={CategoriaEdit}
  show={CategoriaShow}
/>
```

## 🧪 Testing

### Comandos de Verificación
```bash
# Backend
cd server
python migrations/20250917_add_categorias.py

# Verificar endpoints
curl http://127.0.0.1:8000/categorias
curl -X POST http://127.0.0.1:8000/categorias \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Test", "user_id": 1}'

# Frontend
cd app_invoice
npm run dev

# Navegar a:
# http://localhost:3000/admin/categorias
```

## 📊 Resultados Esperados

1. **Backend**: Endpoints `/categorias` disponibles en Swagger
2. **Frontend**: Páginas CRUD navegables desde el menú admin
3. **Base de datos**: Tabla `categorias` con 4 registros de ejemplo
4. **Funcionalidad**: Crear, editar, listar, filtrar y mostrar categorías

---

**Nota**: Este ejemplo sirve como plantilla para copiar y adaptar a cualquier nueva entidad siguiendo el patrón establecido.
