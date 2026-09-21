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

## Parte Diario del Agente v3
- Estructura y contratos: `backend/agente/v3/subprocesses/parte_diario/README.md`.
- Antes de modificar el subproceso, leer ese README y aplicar su guia de cambios. Documenta el patron vigente, las responsabilidades y las particularidades actuales.
- Un cambio funcional no autoriza alterar el patron: cualquier cambio de arquitectura debe acordarse y documentarse explicitamente. No reintroducir capas o caminos alternativos de forma incidental.
- Al finalizar, comprobar las reglas del README y actualizar la documentacion si cambia el contrato o el comportamiento descrito. Criterios de seleccion y procedimiento pytest: `backend/agente/v3/subprocesses/parte_diario/PRUEBAS.md`.
- `flows` conduce las etapas; `domain` agrupa acceso a datos y reglas por entidad; `utils` contiene interpretacion local y presentacion; `adapters` integra servicios externos.
- No agregar SQL a flows ni acceso a datos al renderer. Usar `app.db.engine`, sin dependencias de domain hacia el handler.
- El respaldo `handler_back.py` es referencia historica, no una implementacion ejecutable alternativa.
- Datos de entidades y borrador en `domain/models.py`; contratos de procesamiento en `models.py`; contexto conversacional en `state.py`. `etapa` es el unico selector del procesador del mensaje.
- Comandos comunes en `flows/comandos.py` antes del match; comandos locales por estado. `NO` en carga abre revision sin LLM; las preguntas del interprete usan `carga_aclaracion`, con pregunta y origen conservados. No usar un flag de despacho paralelo.
- Las funciones de domain pueden recibir el estado completo; no agregar una capa para descomponer sus parametros.
- Jornada de partes y tarjas: usar `app.utils.jornada.get_jornada_esperada` con la fecha del parte (lunes a viernes 9h, sabado 6h, domingo 0h), sin defaults horarios fijos ni usar la fecha de la conversacion.
