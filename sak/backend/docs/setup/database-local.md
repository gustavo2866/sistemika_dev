# 🗄️ Configuración de PostgreSQL Local

Configuración detallada de PostgreSQL para desarrollo local.

---

## 1. Instalación de PostgreSQL

### Windows

Descargar desde: https://www.postgresql.org/download/windows/

- PostgreSQL 14+ recomendado
- Durante instalación, recordar la contraseña del usuario `postgres`
- Instalar pgAdmin 4 (opcional, pero útil)

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS

```bash
brew install postgresql@14
brew services start postgresql@14
```

---

## 2. Crear Base de Datos y Usuario

### Conectarse a PostgreSQL

```bash
# Windows / Linux / Mac
psql -U postgres
```

### Crear Database SAK

```sql
-- Crear base de datos
CREATE DATABASE sak;

-- Crear usuario
CREATE USER sak_user WITH PASSWORD 'cambia_esta_clave';

-- Dar permisos
GRANT ALL PRIVILEGES ON DATABASE sak TO sak_user;

-- Conectarse a la base sak
\c sak

-- Dar permisos en el schema public (PostgreSQL 15+)
GRANT ALL ON SCHEMA public TO sak_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sak_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sak_user;

-- Salir
\q
```

---

## 3. Configurar Variables de Entorno

Crear o editar `backend/.env`:

```bash
# PostgreSQL Local
DATABASE_URL=postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak

# Mostrar queries SQL en consola (útil para debug)
SQLALCHEMY_ECHO=1

# Entorno de desarrollo
ENV=dev
```

### Formato de la URL de Conexión

```
postgresql+psycopg://<usuario>:<password>@<host>:<puerto>/<database>
```

**Ejemplo:**
- Usuario: `sak_user`
- Password: `cambia_esta_clave`
- Host: `localhost`
- Puerto: `5432` (default de PostgreSQL)
- Database: `sak`

---

## 4. Verificar Conexión

### Desde Python

```python
from sqlmodel import create_engine

DATABASE_URL = "postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak"
engine = create_engine(DATABASE_URL, echo=True)

# Probar conexión
with engine.connect() as conn:
    result = conn.execute("SELECT version();")
    print(result.fetchone())
```

### Desde psql

```bash
psql -U sak_user -d sak -h localhost
```

---

## 5. Ejecutar Migraciones

```bash
cd backend

# Aplicar todas las migraciones
alembic upgrade head

# Ver historial de migraciones
alembic history

# Ver migración actual
alembic current
```

### Migraciones Incluidas

1. **0001_initial_schema** - Crea todas las tablas desde modelos SQLModel
2. **0002_seed_core_data** - Inserta datos iniciales:
   - Países (Argentina, etc.)
   - Tipos de operación
   - Proveedor demo
   - Usuario admin demo
3. **0003_add_neon_compatibility** - Ajustes para Neon PostgreSQL

---

## 6. Datos de Prueba (Seed Data)

Después de ejecutar las migraciones, tendrás:

### Usuario Demo

```
Email: admin@example.com
Password: admin123
```

### Tablas Creadas

- `users` - Usuarios del sistema
- `clientes` - Clientes
- `proveedores` - Proveedores
- `facturas` - Facturas
- `factura_items` - Items de factura
- `nominas` - Nóminas
- `paises` - Países (Argentina, etc.)
- `tipo_operacion` - Tipos de operación
- `metodo_pago` - Métodos de pago
- ... (ver esquema completo en [database-schema.md](../architecture/database-schema.md))

---

## 7. Herramientas Útiles

### pgAdmin 4

GUI para administrar PostgreSQL visualmente.

Descargar: https://www.pgadmin.org/download/

### DBeaver

Alternativa multiplataforma y gratuita.

Descargar: https://dbeaver.io/download/

### VS Code Extensions

- **PostgreSQL** por Chris Kolkman
- **Database Client** por Weijan Chen

---

## 🆘 Troubleshooting

### Error: "role 'sak_user' does not exist"

```sql
-- Recrear usuario
psql -U postgres
CREATE USER sak_user WITH PASSWORD 'cambia_esta_clave';
GRANT ALL PRIVILEGES ON DATABASE sak TO sak_user;
```

### Error: "database 'sak' does not exist"

```sql
psql -U postgres
CREATE DATABASE sak;
```

### Error: "password authentication failed"

Verificar:
1. Password correcto en `.env`
2. Usuario existe: `psql -U postgres -c "\du"`
3. Configuración de `pg_hba.conf` permite conexión local

### Error: "could not connect to server"

```bash
# Verificar que PostgreSQL está corriendo
# Windows
services.msc  # Buscar "postgresql"

# Linux
sudo systemctl status postgresql

# Mac
brew services list
```

---

## 📚 Ver También

- [Variables de entorno](environment-variables.md)
- [Migraciones con Alembic](../development/migrations.md)
- [Base de datos en Neon (producción)](database-neon.md)
- [Troubleshooting común](../reference/troubleshooting-common.md)
