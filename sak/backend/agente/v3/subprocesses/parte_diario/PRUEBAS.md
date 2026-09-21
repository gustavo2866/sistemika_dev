# Pruebas de parteDiario v3

Complementa el [patron de arquitectura](README.md). Elegir pruebas por riesgo y
archivos afectados, no ejecutar un numero fijo de tests en cada cambio.
Las instrucciones generales estan en el `AGENTS.md` de la raiz.

## Criterios de seleccion

| Cambio | Verificacion necesaria |
| --- | --- |
| Comando o aclaracion | `test_parte_diario_comandos_aclaracion.py`: accion, contexto conservado y llamadas LLM esperadas. |
| Carga o LISTADO | Casos relacionados de `test_parte_diario_carga_flow.py`: normalizacion, lote, pagina y retorno. |
| Prompt o adapter LLM | `test_parte_diario_llm_client.py`, flujo relacionado y prueba real si cambia la interpretacion semantica. |
| Estado o handler | `test_parte_diario_state.py`, `test_parte_diario_handler_inicial.py` y rutas afectadas de carga/revision. |
| Revision o guardado | `test_parte_diario_revision_flow.py`; agregar persistencia/jornada si se tocan esas reglas. |
| Consultas de negocio | `test_parte_diario_domain_consultas.py` y casos de consulta del flow afectado. |
| Encapsulamiento | `test_parte_diario_separacion.py` y pruebas funcionales de lo movido. |
| Solo documentacion | Referencias y concordancia con el codigo; no necesita suite funcional. |

Los archivos viven en `backend/tests/unit`. Ampliar la cobertura cuando se cambia
un contrato compartido, serializacion, despacho, persistencia u orquestacion.
No ejecutar todo `backend/tests` por defecto. El archivo historico
`test_parte_diario_v3.py` puede contener casos del flujo anterior: no sustituye
las pruebas del handler y flows activos.

## Procedimiento con pytest

Usar el entorno Python del backend con sus dependencias y ejecutar desde la raiz
del repositorio. Las fixtures de estos tests preparan DB aislada y adaptadores
controlados; no configurar las pruebas para escribir sobre una base real.

1. Seleccionar el caso que reproduce el problema, con entrada, estado y resultado.
2. Comprobar el fallo antes del arreglo cuando corresponda, o documentar el
   cambio intencional de expectativas al modificar un contrato.
3. Ejecutar el caso corregido y sus vecinos funcionales.
4. Ampliar solo si el alcance comparte contratos o comportamiento con otros flows.
5. Informar comandos, resultados, advertencias y verificaciones no realizadas.

Ejemplos, no una lista obligatoria de ejecucion:

```powershell
# Listar los casos seleccionados sin ejecutarlos.
python -m pytest backend/tests/unit/test_parte_diario_comandos_aclaracion.py --collect-only -q

# Un caso concreto y todas sus variantes parametrizadas.
python -m pytest backend/tests/unit/test_parte_diario_comandos_aclaracion.py::test_no_local_en_carga -q

# Seleccionar familias relacionadas por nombre.
python -m pytest backend/tests/unit/test_parte_diario_comandos_aclaracion.py -k "nomina or aclaracion" -q --tb=short
python -m pytest backend/tests/unit/test_parte_diario_carga_flow.py -k "listado or dos_pendientes" -q --tb=short

# Contratos y limites al tocar estados o encapsulamiento.
python -m pytest backend/tests/unit/test_parte_diario_state.py backend/tests/unit/test_parte_diario_separacion.py -q
```

En `-k`, usar nombres del archivo actual; pytest informa cuantos selecciono y
descarto. Si no selecciona ningun test, no cuenta como verificacion exitosa.
Una falla ajena al cambio debe reportarse sin ocultarla ni modificar otros tests
solo para obtener un resultado verde.

## Casos que no deben perderse

- `NO` en carga abre revision sin LLM ni guardado y en confirmar_salida rechaza
  el descarte. LISTADO navega con `SIGUIENTE`/numero correlativo y finaliza con
  `FINALIZAR`/`99`, siempre sin LLM.
- `nomina` funciona sin LLM y conserva etapa, borrador, pagina y pendientes.
- Una consulta entre pregunta y respuesta no reemplaza la pregunta pendiente.
- La aclaracion incompleta sigue preguntando; la completada aplica operaciones
  comunes; el rechazo vuelve al origen sin cambios ni cierre.
- Los fallos de interpretacion o datos invalidos abren aclaracion. `VOLVER` termina
  ese loop; `SALIR` pide descartar y cancelar recupera la misma pregunta.
- LISTADO congela numero e ID durante todo el recorrido, conserva el catalogo al
  reanudar o volver desde revision y no avanza hasta resolver el lote completo.
- Resolver empleado, obra o encargado no pierde otras novedades del mensaje.
- `test_parte_diario_nomina_estricta.py`: Perez unico local, vigencia inclusiva
  por fecha del parte, autocuracion de tarja ausente/vacia, preservacion de nomina
  parcial, bloqueo de ID externo, ausencia de altas sin validar y transferencia
  desde origen. Fuera del caso defensivo, las fixtures de carga deben preparar
  TarjaNomina; no basta asignar obra/encargado en Nomina.
- Las horas no borran el motivo; una obra mencionada no se propaga a otra persona.
  Una jornada menor a la esperada no puede quedar como PRESENTE sin motivo: debe
  preguntar y conservar las horas en texto libre, LISTADO, correcciones y destinos.
- Guardar respeta fecha y jornada; fallar conserva datos; descartar no elimina DB.
- El cierre guardado informa resultado, obra y fecha, libera el proceso y no anexa
  el menu general en el mismo mensaje.
- `GUARDAR` en carga persiste en un turno sin LLM; `NO` presenta revision y `1`
  guarda. En apertura puntual o al guardar hoy, finaliza sin ofrecer otra fecha.
  Si falla el guardado directo, conserva novedades y permite reintentar en revision.
- `test_parte_diario_ciclo_diario.py`: apertura sin fecha confirma el habil anterior
  y abre hoy automaticamente; fecha explicita finaliza sin continuar. Probar
  anterior inexistente/completado, lunes despues del sabado y recuperacion de hoy
  sin arrastrar novedades. Un fallo de guardado no avanza de fecha.
- `test_parte_diario_destino.py`: trabajo temporal reabre destino CONFIRMADO como
BORRADOR, conserva otras novedades y no afecta otro encargado. Destino CERRADO
rechaza sin guardar el origen ni perder el borrador conversacional.
- La carga manual `Trabajo en` no mueve `Nomina`; una tarja destino CERRADA bloquea
  alta y eliminacion. Con tarja abierta, eliminar revierte la novedad y su costo
  destino y restaura la jornada normal en origen. Las horas destino parten de la
  jornada de la fecha y se distribuyen igual que en el agente: el origen conserva
  `max(jornada - horas_destino, 0)`.

## LLM simulado y real

Una respuesta simulada verifica el contrato, el despacho y la ejecucion; no prueba
que el modelo entienda al usuario. Para cambios semanticos usar tambien el script
optativo con datos ficticios y ejecucion local, sin guardar partes en DB:

```powershell
python backend/scripts/parte_diario_llm_smoke.py --clasificacion-novedades
python backend/scripts/parte_diario_llm_smoke.py --confirmacion-contextual
python backend/scripts/parte_diario_llm_smoke.py --solicitudes-carga
```

Requiere `OPENAI_API_KEY` configurada en el entorno. El script no carga `.env`
automaticamente. Usa `OPENAI_CHAT_REPLY_MODEL` o el default del cliente; las
llamadas consumen API. Nunca imprimir claves ni usar datos reales para esta prueba.

Clasificacion comprueba accidente, permiso, enfermedad, falta y horas por las dos
entradas. Confirmacion comprueba aceptar/rechazar una eliminacion en aclaracion,
con y sin consulta intermedia, y la operacion `retomar_carga` al rechazar.
Solicitudes de carga comprueba que un pedido nuevo ejecuta cambios o pregunta,
sin usar un retorno a carga aunque haya rechazos anteriores en el historial.
Se verifica tanto el plan como su efecto sobre el borrador. Ante un fallo, revisar
el contexto enviado, la pregunta pendiente y las operaciones devueltas; no inferir
el origen del error solo de la respuesta visible.

Un pase con el LLM real no garantiza todas las formulaciones. Registrar las
limitaciones de la prueba; no reemplazar la semantica por atajos de palabras para
hacer pasar un ejemplo. No anunciar una correccion verificada si solo se simulo
la salida que se esperaba del modelo.
