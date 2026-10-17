# Calculo particular de una proyeccion Cash

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
- Si un mes no cerrado no posee una proyeccion, el calculo informa un error;
  no presupone un valor cero.

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

La funcion devuelve el valor calculado y la trazabilidad de cada mes base:
estado del periodo, origen del dato y valor utilizado. Tambien conserva una
fotografia del metodo, detalle, rango relativo, funcion, factor y cuentas ERP
aplicados al calculo.

Los origenes proyectados distinguen entre:

- `PROYECTADO_EXISTENTE`: registro previamente disponible en la base.
- `PROYECTADO_CALCULADO`: resultado anterior de la ejecucion en curso.

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
dentro de los 24 meses visibles y devuelve cada importe con los parametros y
valores base utilizados. Este endpoint no persiste resultados. La pantalla
reemplaza temporalmente los valores editables y solo los guarda cuando el
usuario confirma mediante `Guardar 24 meses`.

El popup permite seleccionar cualquiera de los metodos activos. `Calcular`
utiliza la seleccion como override temporal, sin modificar la cuenta. Al
confirmar `Guardar 24 meses`, la FK `ErpCashCuenta.id_metodo_proyeccion` y los
importes se actualizan dentro de la misma transaccion.

Cada mes visible informa `estado_periodo`. Un periodo sin registro de control
se considera `ABIERTO`, de acuerdo con la regla del calculador. La interfaz
muestra un candado cerrado o abierto y envia a `Calcular` el rango comprendido
entre el primer y el ultimo periodo abierto. La respuesta se combina con los
valores visibles sin reemplazar los periodos cerrados anteriores al rango.

La edicion rapida tambien muestra `Comprometido`, almacenado como un registro
de `ErpCashProyectado` con tipo `COMPROMETIDO`, y `Descripcion`, almacenada en
`observacion`. Ambos campos solo son editables en periodos abiertos. El
backend vuelve a validar el estado y conserva sin cambios los comprometidos
de periodos cerrados aunque sean incluidos en el payload.
