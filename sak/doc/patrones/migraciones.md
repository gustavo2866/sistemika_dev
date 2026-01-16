# Patron de migraciones (alembic)

Este patron define un flujo simple y seguro para crear y aplicar migraciones sin desalinear la base.

## Objetivo
- Evitar multiples heads.
- Evitar crear migraciones con la base atrasada.
- Detectar errores de datos antes de aplicar cambios destructivos.

## Flujo recomendado (siempre igual)
1) Verificar estado
   - `alembic current`
   - `alembic heads`

2) Si hay mas de un head
   - No crear migraciones nuevas.
   - Crear una migracion de merge y aplicarla.
   - Solo despues continuar.

3) Si la base no esta en head
   - `alembic upgrade head`
   - Repetir el paso 1 para confirmar.

4) Crear migracion
   - `alembic revision --autogenerate -m "mensaje claro"`
   - Verificar que `down_revision` apunte al head actual.

5) Aplicar migracion
   - `alembic upgrade head`
   - Confirmar con `alembic current`.

## Criterios de seguridad
- Nunca generar una migracion con la base atrasada.
- Nunca dejar mas de un head sin merge.
- Si una migracion falla por datos (ej: NOT NULL), corregir datos o ajustar la migracion antes de reintentar.

## Comandos base (backend)
```bash
alembic -c alembic.ini current
alembic -c alembic.ini heads
alembic -c alembic.ini upgrade head
alembic -c alembic.ini revision --autogenerate -m "mensaje"
```
