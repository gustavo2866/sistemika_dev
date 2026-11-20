# Calculo particular de una proyeccion Cash

## Duplicar un método

La cabecera de edición ofrece **Duplicar**: solicita el nombre de la copia y
confirmación en un diálogo. Copia la configuración guardada (descripción, estado
activo y reglas no eliminadas), con nuevos identificadores, sin cambiar el
original ni las cuentas Cash que lo usan. Los cambios sin guardar del formulario
no forman parte de la copia. El editor original permanece abierto.

`POST /metodos-proyeccion/{id}/duplicar` recibe `nombre`, recorta espacios y
rechaza nombres vacíos, de más de 200 caracteres o ya utilizados. La copia y sus
reglas se crean en una transacción usando el CRUD anidado vigente. Solo permite
métodos HISTORICO: Relacional y Pendiente tienen el botón deshabilitado y el
backend también rechaza su duplicación.

Desde el editor de proyecciones del panel Cash, **Editar método de proyección**
solo se habilita para métodos Históricos. Pendiente y Relacional tienen la
acción deshabilitada y no permiten navegar a la edición desde ese botón.

`calculate_cash_projection` calcula una cuenta Cash para un unico mes. No
persiste el resultado ni genera otros periodos.

## Seleccion de la regla

La cuenta se vincula con `MetodoProyeccion` mediante
`ErpCashCuenta.id_metodo_proyeccion`. Se selecciona el unico detalle no
eliminado cuya propiedad `mes_destino` coincide con el numero del mes objetivo.

Los campos `mes_base_desde` y `mes_base_hasta` son desplazamientos relativos
al mes objetivo, ambos inclusive. Solo se permiten meses anteriores al mes
objetivo para evitar dependencias circulares.

## Origen de cada valor base

Para cada mes del rango se consulta `ErpCashPeriodo`:

- Si esta `CERRADO`, se utiliza el valor real de `ErpCashDiario`.
- Si esta abierto o no existe el periodo, se utiliza `ErpCashProyectado` de
  tipo `PROYECCION` para la cuenta Cash calculada.
- Para `PROMEDIO`, el rango se recorta desde enero de 2026. Cada mes del rango
  efectivo cuenta en el divisor, incluyendo valores cero y proyecciones nulas o
  faltantes, que aportan cero. Si no queda ningún mes, el resultado es cero.
- En las demás funciones, si un mes no cerrado no posee una proyeccion, el
  calculo informa un error; no presupone un valor cero.

Si el metodo tiene registros activos en `MetodoProyeccionCuenta`, el valor
real es la suma de esas cuentas ERP (`cuenta_codigo`). Si no tiene registros
activos, el valor real se obtiene de la misma `cuenta_cash_id`.

El importe real conserva la convencion del panel Cash:

```text
SUM(-(debe + haber))
```

## Resultado

Sobre los valores mensuales se aplica `ULTIMO`, `PROMEDIO`, `SUMA`, `MAX` o
`MIN`. El resultado se multiplica por `factor` y se redondea a dos decimales.

`ULTIMO` elige el valor distinto de cero del mes más reciente dentro del rango.
Recorre los meses desde el final hacia atrás y acepta valores positivos y
negativos. Si todos son cero, devuelve cero. No busca fuera del rango; conserva
la selección de Real para cerrados y Proyectado para meses no cerrados.

La funcion devuelve el valor calculado y la trazabilidad de cada mes base:
estado del periodo, origen del dato y valor utilizado. Tambien conserva una
fotografia del metodo, detalle, rango relativo, funcion, factor y cuentas ERP
aplicados al calculo.

Los origenes proyectados distinguen entre:

- `PROYECTADO_EXISTENTE`: registro previamente disponible en la base.
- `PROYECTADO_CALCULADO`: resultado anterior de la ejecucion en curso.
- `PROYECTADO_FALTANTE_CERO`: mes sin proyección que aporta cero a `PROMEDIO`.

Los errores por una proyeccion base faltante incluyen `cash_account_id`,
`missing_month` y `reason`, para que un proceso superior pueda decidir si
detiene el calculo, registra una advertencia o asigna cero.

## Proyeccion de una cuenta en un rango

`project_cash_account_range` recibe la cuenta Cash, el periodo desde y el
periodo hasta, ambos inclusive. Normaliza las fechas al primer dia del mes y
calcula los periodos cronologicamente.

Cada resultado calculado se conserva en memoria para que pueda ser utilizado
por los meses siguientes. Los valores calculados en la ejecucion tienen
precedencia sobre una proyeccion existente para el mismo periodo.

El proceso devuelve una lista de `CashProjectionCalculation` y no crea ni
modifica registros en `ErpCashProyectado`. La persistencia queda a cargo de un
proceso posterior.

## Edicion rapida desde el panel

El endpoint `GET /erp/cash/proyectado/quick-edit/values` devuelve los valores
proyectados y, cuando existen movimientos, el importe real mensual de la
misma cuenta Cash.

`POST /erp/cash/proyectado/quick-edit/calculate` calcula el rango solicitado
dentro del horizonte móvil de 24 meses y devuelve cada importe con los parametros y
valores base utilizados. Este endpoint conserva su contrato de previsualización
sin persistir. El editor usa `PUT /erp/cash/proyectado/quick-edit/values?calcular=true`
para **Calcular y guardar**: guarda los cambios del formulario, ejecuta el motor
con esos datos y persiste los resultados en una única transacción. Si falla el
cálculo, revierte toda la operación. El histórico visible se acumula
desde enero de 2026 y no limita los 24 meses proyectados.

El popup permite seleccionar cualquiera de los metodos activos. **Calcular y
guardar** persiste la selección en `ErpCashCuenta.id_metodo_proyeccion`, la
referencia, el factor y los importes antes de calcular. Respeta los meses
manuales y recarga los valores guardados sin cerrar el editor. **Guardar**
persiste los cambios sin recalcular y cierra el editor.

Cada mes visible informa `estado_periodo`. Un periodo sin registro de control
se considera `ABIERTO`, de acuerdo con la regla del calculador. La interfaz
conserva los meses históricos como solo lectura salvo que se amplíe **Período
desde**, con confirmación para guardar cambios históricos. El cálculo aplica al
rango editable. Los límites provienen del servidor, no del año del panel.

La edicion rapida tambien muestra `Comprometido`, almacenado como un registro
de `ErpCashProyectado` con tipo `COMPROMETIDO`, y `Descripcion`, almacenada en
`observacion`. Ambos campos solo son editables en periodos abiertos. El
backend vuelve a validar el estado y conserva sin cambios los comprometidos
de periodos cerrados aunque sean incluidos en el payload.
