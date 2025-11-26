-- Script para crear base de datos y usuario
-- Ejecutar este script como superusuario de PostgreSQL

-- Crear usuario
CREATE USER meta_user WITH PASSWORD 'meta_dev_2025!';

-- Crear base de datos
CREATE DATABASE meta_whatsapp_db 
    WITH OWNER = meta_user
    ENCODING = 'UTF8'
    LC_COLLATE = 'Spanish_Spain.1252'
    LC_CTYPE = 'Spanish_Spain.1252'
    TEMPLATE = template0;

-- Conectarse a la base de datos
\c meta_whatsapp_db

-- Otorgar privilegios
GRANT ALL PRIVILEGES ON DATABASE meta_whatsapp_db TO meta_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO meta_user;

-- Verificar
\l meta_whatsapp_db
\du meta_user
