# AGENTS.md

Instrucciones para agentes automatizados que trabajen en este repo.

## Alcance
- Este archivo vive en la raiz del repo y define convenciones generales.
- Actualizalo cuando cambien procesos, estructura o estandares del proyecto.

## Contenido sugerido
- Flujo de trabajo y herramientas preferidas.
- Convenciones de estilo (lint, formato, naming).
- Como ejecutar tests y builds.
- Rutas importantes del proyecto.

## Patrones
- CRUD backend: ver doc/patrones/crud_backend.md
- CRUD frontend: ver doc/patrones/crud_frontend.md
- Migraciones: ver doc/patrones/migraciones.md

## Tests
- Por defecto, ejecutar tests focalizados segun los archivos modificados, no suites completas.
- Si el cambio afecta un flujo del agente, correr los tests especificos del subproceso y del componente tocado con `pytest ruta -k "caso1 or caso2"`.
- Para cambios en prompts o clientes LLM, correr los tests del prompt/cliente correspondiente y solo los casos funcionales directamente relacionados.
- No correr todo `backend/tests` ni archivos grandes completos salvo que el cambio toque persistencia, modelos compartidos, migraciones, resolucion de contexto, orquestador, o contratos usados por varios procesos.
- Si una suite completa falla por problemas ajenos al cambio, reportar el bloqueo y conservar la verificacion focalizada que si corresponda.

## Componentes UI
- Priorizar componentes reutilizables de `frontend/src/components`.
- Si aplica, usar componentes del kit `shadcn admin`.
- Solo usar componentes de `shadcn/ui` como ultima instancia.
- Evitar crear componentes nuevos si ya existe uno reutilizable.
