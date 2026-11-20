# Estados de subcuentas Cash

La clave de una subcuenta es `(tpo_subcta, nro_subcta)`. La búsqueda del listado
incluye el número, la descripción y la categoría.

`categoria` contiene la clasificación de negocio y puede ser nula. `estado`
admite `activa`, `error` y `bloqueada`. La API y la base rechazan otros estados.
Una subcuenta activa puede no tener categoría. `ERROR` deja de ser una categoría válida
para las subcuentas y no se ofrece en los selects de categorías.

| Estado | Clasificación y procesamiento |
| --- | --- |
| activa | Categoría opcional. Usa el mapeo de cuenta ERP y categoría, con respaldo en el mapeo general. Sin categoría usa el mapeo general. |
| error | Pendiente de clasificación. Sus movimientos se importan al diario para revisión sin asignación automática de cuenta Cash. Las cuentas Fondo conservan su regla independiente por cuenta contable. |
| bloqueada | Conserva su categoría. Todos sus movimientos Cash se incorporan sin cuenta asignada y sus saldos de Fondo se importan completos. No asigna pendientes, incluso con `overwrite`, ni aporta a proyecciones de pendientes. |

La sincronización crea las subcuentas desconocidas en estado `error`, con
categoría nula. No cambia las subcuentas existentes. Si una eliminada
lógicamente reaparece, la restaura en `error` sin categoría; si está bloqueada,
respeta tanto el bloqueo como la eliminación y no la restaura.

Al seleccionar una categoría en el formulario de una subcuenta en error, pasa
a activa. El usuario puede bloquearla conservando su categoría y desbloquearla
como activa con o sin categoría, o como error si requiere clasificación. La API
también activa al asignar categoría a una subcuenta en error si el payload no
especifica un estado. PUT y PATCH validan el estado combinado con los datos
existentes y conservan el control de versión.
La categoría es opcional en todos los estados, tanto en el formulario como en la API.

En el popup compartido de movimientos contables Cash, la columna Subcuenta
permite abrir el formulario de edición mediante tipo y número. El componente
reutilizable `subctas/edit-dialog.tsx` busca la subcuenta en el catálogo y permite
editar estado y categoría. Guardar, cancelar o cerrar devuelve al popup de
movimientos, conserva el detalle abierto y restaura el foco al enlace. No ejecuta
una reconstrucción Cash al guardar; los cambios se aplican en la próxima actualización.

El listado ofrece **Activar** y **Bloquear**, habilitados cuando hay filas seleccionadas.
Activar pide confirmación y cambia únicamente `estado` a `activa`, incluso sin
categoría asignada. Conserva las categorías existentes y se aplica al procesamiento
en la próxima actualización Cash. Ambas acciones comparten el bloqueo durante el envío.
La confirmación de cada acción muestra la cantidad de subcuentas y captura esa selección;
cancelar no modifica datos. Confirmar Bloquear actualiza únicamente `estado` a
`bloqueada`, conserva la categoría y refresca el listado. Durante el envío
deshabilita la acción y el cierre del diálogo. Al terminar correctamente limpia
la selección. El proveedor REST realiza una actualización por ID; si alguna
falla, informa que el bloqueo no se completó y refresca para revisar las filas
que sí pudieron actualizarse antes de reintentar.

El bloqueo impide la asignación de cuenta Cash, pero no excluye renglones ni
congela importes: todos los renglones de un asiento que toca Fondo deben estar
en el diario, asignados a una cuenta Cash o a Sin cuenta. En meses no cerrados
se reconstruyen movimientos y saldos desde los libros locales completos
disponibles, independientemente del estado de la subcuenta. En una actualización
histórica se quita la asignación anterior de las bloqueadas y se recuperan los
renglones y saldos que antes se omitían, sin borrar ni reemplazar los existentes.
Se respeta el estado y la baja lógica del catálogo de subcuentas; no se reactiva
una subcuenta bloqueada para importar sus movimientos. El período conserva
estado y fecha de cierre, y sus contadores reflejan los registros recuperados.
El panel reconoce Fondo por cuenta ERP aunque el renglón no tenga cuenta Cash:
lo mantiene en Fondo para no mezclarlo con las contrapartidas de Sin cuenta.
Los pendientes ya asignados conservan su asignación, pero se excluyen del
recálculo y del detalle de proyecciones. Al recalcular, los importes pendientes
agregados se ajustan; los importes proyectados manuales y comprometidos se
conservan. Cambiar el estado no dispara una reconstrucción: se aplica en la
siguiente sincronización o en **Actualizar Cash**. Al desbloquear, esos procesos
vuelven a considerar la subcuenta.

El importador de subcuentas desde CSV traduce la categoría histórica ERROR a
estado error y categoría nula. Respeta las bloqueadas, incluso si no aparecen
en el CSV, sin modificar ni restaurar esos registros.

## Migración

`699f251847ed` elimina la restricción que exigía categoría para el estado activa.
No modifica datos ni cambia estados existentes. Para revertirla, las subcuentas
activas deben cumplir nuevamente la restricción anterior.

`20261118_cash_subcta_estado` agrega el estado y las restricciones. Conserva
IDs, claves, fechas y eliminaciones lógicas. Convierte categorías ERROR (sin
distinguir mayúsculas y espacios) o vacías en estado error y categoría nula;
el resto pasa a activa con categoría recortada. No modifica los mapeos
históricos de categoría ERROR: dejan de seleccionarse para subcuentas en error.

Aplicar con `python -m alembic upgrade head` antes de iniciar el backend nuevo.
El downgrade repone ERROR donde la categoría sea nula y elimina el estado;
por eso pierde la información de bloqueo.

## Verificación

Pruebas focalizadas: `test_erp_cash_subcta_estado.py`,
`test_erp_cash_diario_sync.py`, `test_erp_cash_pendientes_assignment.py`,
`test_erp_cash_pendientes_projection.py`, `test_erp_cash_map_crud.py`,
`test_generic_crud_text_search.py` y
`tests/scripts/test_sync_erp_cash_subctas_from_csv1.py`.
