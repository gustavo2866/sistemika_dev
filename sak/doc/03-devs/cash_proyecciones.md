# Proyecciones Cash por cuenta y período

`erp_cash_proyectado` contiene un registro activo por `cuenta_cash_id` y
`fecha_periodo`. El período corresponde al primer día del mes. Las bajas
lógicas no participan en el índice único ni en las consultas operativas.

## Horizonte móvil e histórico

`cash_projection_horizon.get_projection_horizon` es la definición común del
rango. La proyección comienza en el primer EN_CIERRE o, si no hay ninguno, en
el primer ABIERTO, y abarca 24 meses inclusive. Si solo hay períodos cerrados,
comienza en el mes siguiente al último cerrado; sin períodos, en enero de 2026.
El histórico visible comienza en enero de 2026 y nunca se elimina al avanzar
el horizonte. Diciembre de 2025 conserva su función de saldo base.

Por ejemplo, con octubre de 2026 en cierre se proyecta hasta septiembre de
2028. El editor devuelve 33 filas: nueve históricas y 24 de proyección. Al
cerrar octubre se proyecta noviembre de 2026 a octubre de 2028 y el editor
devuelve 34 filas. El año visible del panel no define estos límites.

`GET /erp/cash/projection-horizon` devuelve `historico_desde`,
`proyeccion_desde`, `proyeccion_hasta`, `meses_proyeccion` y
`ultimo_periodo_cerrado`. El editor, la reconstrucción, la sincronización ERP
y el generador usan este mismo rango predeterminado. Los rangos explícitos
del generador y de la reconstrucción siguen disponibles para tareas históricas.

El CRUD de períodos extiende y recalcula el horizonte al cambiar el estado
o la fecha de un período, en la misma transacción. Conserva Proyectado manual,
Comprometido, observaciones y todos los registros cerrados. Si falla un cálculo,
se revierte también el cambio de período. Pendientes vencidos se acumula en el
primer mes del horizonte, usando la misma definición de inicio.

La API de edición rápida admite una lista de longitud variable: exige los
24 meses proyectados y permite incluir el histórico. Calcula solo el horizonte
y guarda únicamente sus meses no cerrados. Si cambió el rango desde la lectura,
exige recargar antes de guardar. No elimina filas fuera del rango.

## Importes y total

- `importe_proyectado`: estimación manual, calculada o importada desde la
  plantilla de presupuesto Cash.
- `importe_pendiente`: saldo de comprobantes pendientes, editable o reconstruido
  desde Pendientes Cash.
- `importe_comprometido`: compromisos adicionales. `observacion` conserva su
  descripción en la edición rápida.
- `total_proyectado`: columna `GENERATED ALWAYS ... STORED`, no editable.

La columna generada suma Comprometido a Pendiente cuando `tipo_calculo` es
`PENDIENTE`; en los demás casos suma Comprometido a Proyectado. Los tres
componentes son obligatorios y tienen valor predeterminado cero. No se suman
Proyectado y Pendiente entre sí.

## Método aplicado

El catálogo `metodo_proyeccion` define `tipo_calculo` (`HISTORICO`, `RELACIONAL` o `PENDIENTE`).
Es un criterio estable, independiente del nombre editable del método.

Cada registro mensual guarda `id_metodo_proyeccion` y una copia de
`tipo_calculo`. La columna generada depende exclusivamente de esa misma fila:
no consulta el catálogo y funciona también con escrituras SQL externas.

Al crear un período se copia el método predeterminado de la cuenta, salvo que
se indique otro explícitamente. Sin método se usa `HISTORICO`. Cambiar el
catálogo o el método predeterminado de una cuenta no modifica períodos ya
guardados. Al guardar un método desde la edición rápida, se aplica a los
24 meses del horizonte de proyección; los meses históricos se conservan.
El CRUD de un período permite elegir su método explícitamente.

Los consumidores que escriban directamente en la base deben guardar ambos
campos del método aplicado. Los importes y `tipo_calculo` recalculan el total
automáticamente. No escribir `total_proyectado`.

## Consumidores

El icono de mapeo de cada cuenta ERP del panel, tanto en el detalle de cuentas
Cash como en los saldos Fondo, abre `CashAccountMappingsDialog` del recurso
`cashflow/maps`. Consulta los mapeos con filtro fijo `nro_cta` y muestra Cuenta
ERP, Categoría, Debe y Haber, con paginación. No consulta mapeos mientras el
popup está cerrado. Al seleccionar una fila reutiliza el formulario de edición;
Agregar reutiliza el formulario de creación con la cuenta ERP preseleccionada.
Guardar o cancelar vuelve a la lista y cerrar la lista vuelve al panel. Los
guardados refrescan la lista y el panel; no ejecutan una reconstrucción Cash.

Los importes de la columna Real del editor abren el mismo detalle contable que
el panel, filtrado por cuenta Cash y mes. `CashMovementDetailDialog`, en
`cashflow/diario/movement-detail-dialog.tsx`, encapsula la consulta, la tabla,
el total y la exportación XLS. El detalle se abre sobre el editor y al cerrar
devuelve el foco al importe seleccionado, conservando los cambios sin guardar.

`CashPendingProjectionDetailDialog` ofrece el detalle de comprobantes pendientes
por cuenta Cash, con límites de vencimiento opcionales. Los importes Pendiente
del editor abren el mes correspondiente; el primer mes proyectado incluye los
vencidos anteriores. El botón Pendientes de la fila de cálculo abre todos los
pendientes válidos de la cuenta, sin limitar las fechas ni el horizonte. Ambos
accesos conservan el editor abierto y devuelven el foco al control de origen.
Se excluyen registros eliminados, inválidos y de subcuentas bloqueadas.

El panel de Cashflow, sus totales de cuenta/grupo y sus saldos acumulados leen
`total_proyectado`. Los reportes externos pueden usar directamente:

```sql
SELECT cuenta_cash_id, fecha_periodo,
       importe_proyectado, importe_pendiente, importe_comprometido,
       total_proyectado, id_metodo_proyeccion, tipo_calculo
FROM erp_cash_proyectado
WHERE deleted_at IS NULL;
```

La edición rápida devuelve los componentes y el total persistido; su pantalla
solo calcula una previsualización para cambios aún no guardados. Su API usa
`importe_proyectado`, en reemplazo del anterior `importe`, y deja de exponer
un `tipo` por fila. El CRUD y su exportación muestran los cuatro importes.

La plantilla de presupuesto Cash sigue importando/exportando el componente
Proyectado, sin reemplazar Pendiente ni Comprometido. El cálculo por reglas
toma ese mismo componente como base de los meses abiertos; no realimenta los
compromisos adicionales al calcular otra proyección.

La reconstrucción de pendientes actualiza solo `importe_pendiente`, pone en
cero los saldos que dejaron de existir y conserva los otros componentes,
el método aplicado y las observaciones de los períodos existentes.

## Reconstrucción y valores manuales

### Función Ajuste ponderado

`AJUSTE_PONDERADO` es una función de las reglas de métodos Históricos. Usa el
último mes del rango base (`mes_base_hasta`), no agrega los demás meses.
Su factor debe ser finito y estar entre 0 y 1; `0,2` incorpora el 20 % del
desvío. Se valida al guardar el método y al ejecutar el cálculo.

Con `P` igual al Proyectado de ese mes y `R` a su Real:

- Si el mes base está CERRADO y tiene un real registrado: `P + (R - P) × factor`.
- Si está ABIERTO o EN_CIERRE, o todavía no hay real: conserva `P`.

El real registrado en cero sí participa. Si falta el Proyectado base, informa
el período faltante; no lo reemplaza por cero ni por el real. El factor se
aplica una sola vez y el resultado se redondea a centavos. La previsualización
incluye el proyectado base y, cuando participa, el real utilizado en su traza.
Los meses destino manuales conservan sus importes. Calcular, Proyectar,
Actualizar Cash y Sincronizar ERP utilizan el mismo motor. La clasificación
cerrado/abierto proviene siempre del estado real del calendario, incluso al
editar desde un período histórico. No requiere migración: `funcion` ya es una
columna de texto de 20 caracteres.

`origen_proyectado` distingue `MANUAL` de `CALCULADO`. La migración
`20261114_cash_local` conserva el histórico como MANUAL porque el esquema
anterior no registra ese origen. Para volver al cálculo automático de un mes
editable, se desactiva **Manual**, se usa **Calcular** y se guarda el resultado.
La migración `20261118_cash_manual_off` desactiva Manual en todos los registros
activos desde octubre de 2026, conservando importes, métodos y observaciones.
Los nuevos registros se crean como `CALCULADO` (Manual apagado) por defecto,
tanto por SQL como por el modelo, el CRUD y el editor. Manual sigue disponible
como elección explícita del usuario. El downgrade restablece el default anterior
sin revertir los cambios de origen realizados sobre registros existentes.
El editor también permite **Desactivar Manual en todo el rango**, respetando
Período desde y los meses editables, para aplicar el método sin cambiar cada
mes por separado. **Calcular** guarda la configuración y los valores
del editor antes de ejecutar el motor y persiste los resultados en la misma
transacción. Si el cálculo falla, revierte también el guardado. El editor
permanece abierto y recarga los valores persistidos. Si todos los meses son
manuales, guarda los cambios e informa que no recalculó ningún período.

La edición de un importe, la importación desde la plantilla Excel y el reset
explícito de Proyectado lo marcan MANUAL. El toggle Manual controla el origen
mensual; Calcular no lo cambia. El generador crea los nuevos meses como
CALCULADO. Editar solo Comprometido o su
descripción no cambia el origen de Proyectado.

**Reconstruir Cash** actualiza el método aplicado de las cuentas de Ingreso y
Egreso en los períodos incluidos del rango (los cerrados solo con
`incluir_cerrados=true`). Conserva `importe_proyectado`
cuando es MANUAL; cuando es CALCULADO y el tipo es HISTORICO o RELACIONAL, lo recalcula
cronológicamente con las reglas vigentes. Los manuales también sirven como base
para los meses siguientes. Un método de tipo PENDIENTE usa el saldo pendiente
reconstruido, sin sobrescribir Proyectado ni ejecutar reglas innecesarias.
Comprometido y las observaciones se conservan. Los totales siguen siendo
generados por la base de datos.
Las descripciones automáticas históricas que comienzan con `AUTO:` se eliminan:
la migración `20261118_cash_clear_auto` limpia los datos existentes y el
recálculo, el CRUD y el guardado del editor descartan esos textos si reaparecen
desde un editor abierto con datos antiguos. Los nuevos cálculos no generan
descripciones automáticas. Las notas escritas por el usuario se conservan.

En la ejecución habitual, los períodos cerrados conservan también su método
aplicado; en una reconstrucción histórica explícita se actualiza. Los pendientes
de meses cerrados se conservan siempre: los CSV representan la deuda actual,
no una fotografía histórica que permita recalcularlos. La
reasignación de pendientes usa `overwrite=true`, incluye saldos ya asignados y
limpia una asignación que dejó de tener mapeo. La reconstrucción de sus importes
respeta el rango solicitado y conserva las filas de períodos cerrados.

Toda la operación de reconstrucción es transaccional y usa solo datos locales.
El motor carga cuentas, métodos, proyecciones, estados y bases históricas una
sola vez por ejecución; reutiliza esos datos para todas las cuentas y meses,
sin realizar consultas por cada celda calculada.
Actualizar Cash usa los libros importados hasta ese momento, sin exigir marcas
de importación completa. Si un libro todavía no tiene datos ni una importación
vacía confirmada, conserva sus movimientos o saldos Cash existentes; el otro
libro disponible se procesa igualmente. No consulta el ERP.
Los movimientos y saldos reales de un mes CERRADO se conservan siempre, incluso
con `incluir_cerrados=true`: ese indicador permite recalcular proyecciones
históricas, pero no reemplazar los reales sincronizados. Para volver a importar
o reconstruir los reales hay que reabrir explícitamente el período.
Sincronizar ERP invoca esta misma operación al finalizar la carga de pendientes,
desde el mes inicial sincronizado hasta el final del horizonte móvil.
Ver detalles de importación y disponibilidad de libros en `cash_periodos.md`.

## Tipos y configuración

- **HISTORICO**: requiere al menos una regla; cada mes destino tiene como máximo
  una regla, función y factor finitos, bases negativas y ordenadas. Usa reales
  de la propia cuenta Cash para bases cerradas y Proyectado para las abiertas.
- **RELACIONAL**: sin reglas. Cada `erp_cash_cuentas` que lo utiliza requiere
  `cuenta_cash_referencia_id` (FK a la misma tabla) y `porcentaje` finito.
  El cálculo es `proyectado de la referencia del mismo mes * porcentaje / 100`.
  `5` representa 5 %. Se permiten cero y porcentajes negativos.
- **PENDIENTE**: sin reglas ni referencia. Su valor efectivo para una dependencia
  es `importe_pendiente`; no incluye Comprometido ni usa el Proyectado anterior.

La referencia y el porcentaje se limpian al asignar un método no relacional.
Los métodos nuevos son siempre Históricos y requieren reglas. `tipo_calculo`
es de solo lectura tanto en pantalla como en la API; los métodos especiales
Pendientes y Relacional se crean mediante seeds. En el formulario el tipo se
muestra como texto compacto junto a Activo, sin selector editable. La tabla
`metodo_proyeccion_cuenta` y su lista de cuentas ERP fueron eliminadas.

## Dependencias y motor compartido

Los CRUD de cuentas y métodos y el guardado de edición rápida validan el grafo
antes de confirmar. Una referencia directa o un ciclo indirecto se rechaza con
la cadena de nombres completa; los cambios se revierten. PostgreSQL serializa
las escrituras de configuración mediante un bloqueo asesor transaccional
compartido, evitando que dos cambios simultáneos introduzcan un ciclo.

`CashProjectionEngine` resuelve recursivamente las referencias del mismo mes,
reutiliza resultados por `(cuenta, mes)` y mantiene una pila de cálculo como
respaldo contra ciclos. Los importes manuales de referencias se usan tal como
están, sin sumar Comprometido. Los calculados se resuelven con la configuración
vigente. Las referencias sin método requieren un Proyectado ya disponible.
Un faltante histórico produce un error, sin inventar ceros para meses abiertos.

La generación compartida procesa primero todas las cuentas de un mes y luego
avanza al siguiente; el orden de IDs no define el orden de cálculo. Conserva
manuales y comprometidos. Reconstruir Cash y Sincronizar ERP usan esta misma
generación; Calcular y guardar en edición rápida usa el mismo motor y persiste
los resultados, respetando los importes manuales de la cuenta editada y sus dependencias. Los
automáticos posteriores usan esos valores manuales como base cuando corresponda.

La cabecera de edición rápida muestra **Cuenta Cash** y **Factor (%)** a la
derecha del botón de editar método cuando se selecciona Relacional. Ambos son
obligatorios; `5` sigue representando 5 %. `quick-edit/values` devuelve
`cuenta_cash_referencia_id` y `porcentaje`. El PUT permite guardarlos junto al
método y los 24 importes en una sola transacción, validando ciclos y revirtiendo
todo ante errores. El POST `quick-edit/calculate` acepta los mismos parámetros
por query para previsualizar la configuración sin modificar la cuenta. También
acepta un body opcional con `values`: período, importe y origen de los meses
editables. Esto permite respetar valores y toggles aún no guardados y recalcular
un mes cuyo origen se cambió de MANUAL a CALCULADO. Sin body, usa los orígenes
persistidos. El editor muestra candados de estado y el toggle Manual por mes;
las restricciones de edición de períodos cerrados se mantienen.

### Período desde en el editor

El campo **Período desde**, junto a Calcular, toma por defecto el primer mes
en cierre o abierto del horizonte operativo. Admite desde enero de 2026 hasta
ese mes. Cambiarlo solo afecta el editor: no mueve el horizonte móvil de 24
meses ni cambia los estados del calendario.

Elegir un mes anterior habilita Manual, Proyectado (si Manual está activo),
Comprometido y su descripción desde ese mes, incluyendo los cerrados. Real y
Pendiente históricos permanecen de solo lectura. Calcular usa proyectados para
las bases desde el mes seleccionado, respetando los manuales; antes de esa
fecha sigue tomando los reales de meses cerrados. El resultado es una
previsualización y no modifica datos hasta guardar.

El body de calcular y guardar acepta `periodo_referencia` como primer día del
mes. Guardar con una referencia anterior al período operativo requiere además
`confirmar_historico=true`; el formulario presenta una confirmación explícita.
El servidor valida ambos límites, conserva Real, Pendiente histórico y estados,
y confirma los cambios de proyección en una transacción. Sin referencia se
mantiene el comportamiento normal de protección del histórico. Al acortar el
rango, el formulario impide guardar si quedaron cambios anteriores al nuevo
inicio. Los totales siguen excluyendo los períodos cerrados.

El script `backend/scripts/generate_erp_cash_proyectado.py` usa este motor y
reemplaza la anterior heurística de mes homólogo/promedio. Admite `--start`,
`--months` y `--dry-run` o `--apply`; omite cerrados y revierte toda la operación
ante errores.

## Migración de tipos y seeds

`20261114_cash_relacional` sucede a `20261114_cash_local`. Reemplaza
`base_calculo` por `tipo_calculo` en métodos y períodos, migra PROYECTADO a
HISTORICO y conserva PENDIENTE. Recrea el total generado con el nuevo campo,
conservando sus componentes. Añade la referencia/porcentaje a cuentas, elimina
las asociaciones ERP y descarta las reglas que no corresponden a Pendiente.

`20261114_cash_metodos_seed` crea Relacional y actualiza Pendiente a Pendientes
conservando su ID; ambos quedan activos, con tipo explícito y sin reglas.
El seed es idempotente y se puede reaplicar con:

```powershell
python scripts/seed_cash_projection_methods.py
```

La migración se verifica con `tests/migrations/test_cash_relational_methods.py`
en un esquema PostgreSQL aislado y revertido, incluyendo integridad de importes,
FK y repetición de seeds. La eliminación de asociaciones ERP es irreversible.

## Migración original de importes

`20261113_cash_columnas` sucede a `20261111_cash_en_cierre`:

1. Clasifica el método llamado `Pendiente` como base `PENDIENTE`; los demás
   quedan con base `PROYECTADO`.
2. Consolida las filas activas de Proyección, Pendiente y Comprometido por
   cuenta/período. Conserva los importes, la primera creación, la última
   modificación y prioriza la observación de Comprometido. Las filas con baja
   lógica se conservan separadas y no se suman a los activos.
3. Inicializa el método de cada período con la asignación actual de su cuenta;
   el esquema anterior no guarda un método histórico por período.
4. Descarta Presupuesto y Ajuste por decisión funcional, elimina `tipo` e
   `importe`, crea el índice único y la columna total generada.

Es un cambio de contrato: actualizar backend, frontend, scripts y consultas
externas de forma coordinada. La migración es irreversible; para volver al
esquema por tipos hace falta restaurar un backup anterior. No ejecutar su
`downgrade` esperando recuperar datos descartados.

La prueba `backend/tests/migrations/test_cash_proyectado_columnas.py` requiere
`MIGRATION_TEST_DATABASE_URL` y ejecuta la migración en un esquema PostgreSQL
aislado dentro de una transacción que se revierte al finalizar. No aplica la
migración al esquema operativo ni modifica `alembic_version`.
