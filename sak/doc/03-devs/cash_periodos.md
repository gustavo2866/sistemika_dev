# Estados de periodos del Cash Panel

Los estados se administran manualmente en Periodos Cash. No se infieren de la
fecha actual ni cambian automaticamente al sincronizar.

La pantalla Sincronizar ERP selecciona el primer periodo EN_CIERRE por fecha
ascendente. Si no existe ninguno, selecciona el primer ABIERTO. Espera la carga
de ambos estados antes de habilitar la sincronizacion; sin periodos disponibles
o ante un error de consulta, el boton permanece deshabilitado.

| Estado | Saldos del panel | Sincronizacion |
| --- | --- | --- |
| ABIERTO | Proyectados | Permitida |
| EN_CIERRE | Reales sincronizados, provisionales, con detalle por cuenta Fondo | Permitida; conserva EN_CIERRE |
| CERRADO | Reales sincronizados, definitivos, con detalle | Reconstrucción habitual bloqueada; la histórica explícita permite recalcular sin reapertura |

Durante el cierre contable se usa EN_CIERRE para incorporar ajustes del ERP sin
perder la apertura real de los saldos. El panel resalta la cabecera de estos
meses en ambar, sin texto adicional, y muestra el estado y la ultima
sincronizacion al pasar el cursor por la cabecera. Si no hay saldos
sincronizados, muestra "Sin datos".

Los meses ABIERTO encadenan sus proyecciones desde el saldo final real mas
reciente de un periodo EN_CIERRE o CERRADO, incluyendo cuando ese periodo queda
fuera del rango visible. Las proyecciones intermedias se suman hasta llegar al
mes inicial del panel.

La importación se ejecuta desde **Sincronizar ERP**. Los libros locales incluyen
las empresas Cash (1, 2 y 5), además del alcance anterior de obras. El campo
`es_obra` conserva el alcance de los cálculos de presupuesto y del panel de
reales de obras. El catálogo de cuentas también incorpora las cuentas de Cash.
Las importaciones completas registran `diario_cash_importado` y
`mayor_cash_importado` en el período, dentro de la transacción del libro.
La importación por rango de Libro Mayor registra la misma marca, incluso si
el mes está vacío o no existen centros de costo de proyectos. Las inserciones
se ejecutan en lotes uniformes para evitar fragmentarlos por columnas nulas.
Libro Mayor importa únicamente `nivel = 'subcuenta'`: excluye los resúmenes
por cuenta desde la consulta al ERP, conservando el alcance de obras y Cash.

Sincronizar ERP comienza en el primer período EN_CIERRE o, si no hay ninguno,
en el primer ABIERTO. Antes de confirmar consulta los períodos con movimientos
en Diario o Mayor del ERP, con el mismo alcance de Obras/Cash y solo subcuentas
en Mayor. Importa ambos libros y actualiza Presupuesto hasta el último mes
detectado. También procesa meses intermedios vacíos para reemplazar datos
anteriores y registrar su importación completa. No extiende el rango hasta
meses sin movimientos posteriores al último detectado.

### Cierre desde Sincronizar ERP

La casilla **Cerrar [mes] al finalizar** está desmarcada por defecto. Después
de validar los CSV, `POST /erp/cash/sync/start` recibe `periodo` y pasa el primer
mes no cerrado de ABIERTO a EN_CIERRE. Si ya está en cierre, permite reintentar
sin cambiarlo. Rechaza meses cerrados, saltos y otros períodos en cierre.
Importar movimientos de meses posteriores no los pone en cierre.

El paso final usa el mismo `POST /erp/cash/rebuild`, con `cerrar_periodo=true`
solo si se eligió cerrar. Verifica que sea el primer no cerrado, esté EN_CIERRE
y tenga ambos libros importados. Cierra únicamente ese mes, registra
`cerrado_en`, crea los períodos abiertos faltantes desde el mes siguiente para
completar 24 meses y recalcula el nuevo horizonte. El cierre y la extensión de
Cash comparten transacción: si fallan, se revierten y el mes sigue EN_CIERRE.
Los libros y CSV importados en etapas anteriores conservan sus transacciones.
Sin la casilla, el mes sigue EN_CIERRE. El siguiente mes pasa a EN_CIERRE recién
cuando se inicia su propia sincronización. No requiere una migración de esquema.

Al finalizar Sincronizar ERP, la reconstrucción recibe `periodo_reales_hasta`
con el último mes sincronizado: reconstruye sus reales y calcula las proyecciones
hasta el final del horizonte sin exigir libros de meses posteriores. Si se
omite ese parámetro, se actualizan los reales disponibles en todo el rango.

**Actualizar Cash**, en el panel, usa exclusivamente esos libros locales y el
catálogo importado. Reaplica los mapeos, reconstruye movimientos y saldos,
reasigna pendientes y recalcula las proyecciones automáticas con el método
vigente de cada cuenta. El motor resuelve recursivamente las dependencias
relacionales del mismo mes, valida ciclos y procesa los meses cronológicamente.
Abre un diálogo con el primer mes EN_CIERRE como valor
predeterminado; si no hay ninguno, usa el primer ABIERTO. El usuario puede
elegir otro mes desde diciembre de 2025. Si no hay períodos de esos estados,
se usa el mes posterior al último cerrado o enero de 2026 si no existen
períodos. El rango termina al completar 24 meses desde el primer período en
cierre o abierto, independientemente del año posicionado en el panel.

La reconstrucción solicitada desde el panel incluye las proyecciones de los
CERRADO del rango y reaplica sus mapeos sobre los movimientos Cash guardados,
conservando importes y saldos sincronizados,
sin reabrirlos ni cambiar sus datos de cierre. Conserva importes manuales y
comprometidos. Diciembre de 2025 es el saldo base fijo: si se elige como inicio,
el rango efectivo comienza en enero de 2026 y no modifica los registros base.

`POST /erp/cash/rebuild` recibe `periodo_desde` en formato YYYY-MM;
`periodo_hasta` es opcional y usa por defecto el fin del horizonte móvil.
`incluir_cerrados` es un booleano opcional (predeterminado `false`) que habilita
reaplicar mapeos de movimientos Cash y recalcular proyecciones históricas. No
borra ni reemplaza reales cerrados: actualiza únicamente la cuenta Cash y la
auditoría de los movimientos existentes, incluso sin libros locales. Respeta
el estado y la baja lógica del catálogo de subcuentas, sin excluir movimientos
ni saldos por bloqueo. Recupera renglones y saldos faltantes desde los libros
locales, sin reemplazar los existentes. Permite
rangos históricos de más de 24 meses, rechaza inicios anteriores a diciembre
de 2025 y excluye siempre el mes base. Realiza todos los cambios en una
transacción: un error revierte también los períodos ya procesados. Devuelve
el rango efectivo y los conteos `periodos_cerrados_omitidos` y
`periodos_cerrados_reconstruidos` (meses cerrados cuyos mapeos se reprocesaron).
Los movimientos informados incluyen las filas cerradas examinadas; sus saldos
no se reemplazan, pero se recuperan los faltantes. El período conserva estado
y fecha de cierre; los contadores y la auditoría se actualizan si recupera filas.
`POST /erp/cash/diario/sync` queda como entrada de reconstrucción local de un
solo período; ya no importa del origen. Un CERRADO devuelve HTTP 409.

La reconstrucción de movimientos y saldos actualiza `ultima_sincronizacion`,
`movimientos_count` y `saldos_count`. Los meses futuros sin libros importados no
se reemplazan por conjuntos vacíos; solo participan en la proyección.

Al finalizar, `conciliacion` informa `consistente`, cantidad de `controles`,
`diferencias` y hasta 100 registros de `detalle`. Verifica asientos balanceados,
la presencia de todos los renglones elegibles de los libros locales,
saldo anterior más movimiento igual a saldo actual, movimientos de Fondo del
diario contra Mayor, y continuidad con el saldo final del mes anterior cuando
está disponible. Agrupa por empresa, mes y cuenta ERP, sin excluir bloqueadas
ni compensar diferencias entre empresas; admite hasta un centavo de diferencia.
Si no puede evaluar controles, `consistente` es nulo. La actualización no inventa
ajustes ni cambia datos de origen para forzar igualdad: devuelve las diferencias
y el panel muestra una advertencia en lugar del mensaje de éxito normal.

Actualizar Cash procesa los libros locales disponibles aunque falten las marcas
de importación completa. Octubre EN_CIERRE no impide procesar las transacciones
ya importadas de noviembre ABIERTO. Cada libro se trata por separado: si no tiene
filas ni una importación vacía confirmada, conserva sus datos Cash existentes.
Una importación completa con cero filas sí permite vaciar el Cash derivado de
ese libro en meses ABIERTO o EN_CIERRE. No consulta el ERP. Las marcas indican disponibilidad de la última
importación, no que el mes haya terminado o esté cerrado.

La limpieza de libros futuros omite los meses CERRADO incluso con una fecha de
corte anterior: conserva libros, reales de presupuestos y marcas de importación.
Invalida ambas marcas únicamente en los meses no cerrados que limpia.
Sincronizar ERP termina llamando a `POST /erp/cash/rebuild`, el mismo
proceso usado por el botón Reconstruir Cash. Lo hace después de importar todos
los CSV de pendientes, desde el mes sincronizado hasta diciembre del año
siguiente, con `incluir_cerrados=false` y sin diálogo. La asignación Cash y la reconstrucción de pendientes forman parte
de esa operación, sin pasos separados ni lógica duplicada.

La sincronización solo informa éxito después de completar la reconstrucción.
Si esta falla, se muestra el error en la etapa Reconstruir Cash y se aclara que
los datos ERP ya quedaron importados: las etapas de importación anteriores
tienen sus propias transacciones. Se puede corregir la causa y reconstruir
desde el panel sin volver a importar.

Para habilitar el estado en una base existente, aplicar la migracion
20261111_cash_en_cierre. La migracion no cambia estados existentes. Su downgrade
convierte EN_CIERRE a ABIERTO antes de restaurar la restriccion anterior.

Verificacion focalizada, desde backend:

```powershell
python -m pytest tests/unit/test_erp_cash_periodo_model.py tests/unit/test_erp_cash_diario_panel.py tests/unit/test_erp_cash_diario_sync.py -q
```

## Protecci?n de datos sincronizados cerrados

Los importadores de Libro Diario y Libro Mayor rechazan un mes CERRADO antes
de consultar el origen o borrar registros, incluso si reciben un origen vac?o.
La reconstrucción Cash conserva los movimientos y saldos originales. Con
`incluir_cerrados=true` reaplica los mapeos vigentes sobre movimientos guardados
sin borrarlos ni reimportarlos, aunque falten libros locales. Para reemplazar
los datos de origen de un histórico es necesario reabrir explícitamente su período.

La migraci?n `4a9ed248e4b0` agrega protecci?n PostgreSQL a `erp_libro_diario`,
`erp_libro_mayor`, `erp_cash_diarios`, `erp_cash_saldos`, `erp_presupuestos` y
`erp_cash_periodos`. Rechaza DELETE, baja l?gica y traslado de datos desde meses
CERRADO; tambi?n TRUNCATE mientras existan meses cerrados. Se aplica a SQL,
CRUD y scripts; no depende de que cada llamador recuerde validar el estado.
Un bloqueo del per?odo serializa la protecci?n con cierres y reaperturas.
No afecta las revalorizaciones ICC ni la edici?n expl?cita de proyecciones.
El downgrade elimina los triggers y funciones, sin cambiar registros.
