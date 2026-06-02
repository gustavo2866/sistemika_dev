# Agente de obra por WhatsApp

## Objetivo

El agente permite que el encargado de obra gestione por WhatsApp:

- Pedidos de materiales.
- Partes diarios de asistencia.
- Consultas simples, como ver la nómina del proyecto o el parte del día.

El encargado escribe mensajes normales. No necesita usar un formato rígido para informar
materiales o novedades. El agente interpreta el mensaje, muestra el resultado y solicita
aclaraciones cuando faltan datos.

## Reglas generales

### Alcance actual

El número de WhatsApp del encargado debe estar registrado y asociado a una única obra
activa. Si el número no está reconocido o el proyecto no está activo, el agente informa
la situación y no inicia ningún proceso.

### Un proceso activo por vez

Solo puede existir un proceso activo por conversación:

- Un pedido de materiales.
- Un parte diario.
- Ninguno.

Si hay un pedido abierto y el encargado intenta informar un parte diario, el agente le
solicita finalizar o cancelar el pedido. Lo mismo ocurre si intenta iniciar un pedido
mientras está cargando un parte.

Ejemplo:

```text
Encargado: "Necesito 10 bolsas de cemento"
Agente: registra el pedido y lo mantiene abierto.

Encargado: "Hoy faltó García"
Agente: "Tiene un pedido de materiales en curso.
        Para informar el parte diario debe finalizar o cancelar el pedido actual.
        Escriba CONFIRMAR para enviar el pedido o CANCELAR para descartarlo."
```

### Inicio automático

Cuando no hay un proceso activo, el agente intenta identificar la intención a partir del
primer mensaje.

| Mensaje | Resultado |
|---------|-----------|
| `"Necesito 20 bolsas de cemento"` | Inicia un pedido de materiales y registra el cemento |
| `"Hoy faltó García"` | Inicia un parte diario y registra la novedad |
| `"Mostrame la nómina"` | Responde la consulta sin abrir un proceso |
| `"Mostrame el parte de hoy"` | Responde la consulta sin abrir un proceso |

Si el mensaje es ambiguo, el agente ofrece opciones:

```text
Agente: "¿Qué desea realizar?
        1) Pedido de materiales
        2) Parte diario de asistencia"

Encargado: "la segunda"
Agente: inicia el parte diario.
```

### Comandos de cierre

Guardar o descartar información requiere un comando explícito enviado como mensaje
completo:

| Comando | Acción |
|---------|--------|
| `CONFIRMAR` | Guarda la información y cierra el proceso activo, si todos los datos son válidos |
| `CANCELAR` | Descarta el proceso activo sin guardar cambios |

El agente ignora mayúsculas, minúsculas, tildes y espacios al inicio o al final. Por
ejemplo, `" confirmar "` y `"CONFIRMAR"` son equivalentes.

Las expresiones como `"listo"`, `"ok"`, `"sí"` o `"mandalo"` no guardan información
directamente. Pueden indicar que el encargado desea terminar la carga. En ese caso, el
agente muestra un resumen y solicita escribir `CONFIRMAR`.

Del mismo modo, una frase como `"descartar pedido"` no elimina información directamente.
El agente solicita escribir `CANCELAR`.

Si el encargado estaba corrigiendo un parte ya guardado como borrador, `CANCELAR`
descarta únicamente los cambios todavía no confirmados. La versión previamente guardada
permanece sin modificaciones.

## Pedido de materiales

### Carga del pedido

El encargado puede informar materiales en uno o varios mensajes:

```text
Encargado: "Necesito 10 bolsas de cemento y 5 barras de hierro"
Agente: muestra el pedido actualizado.

Encargado: "También 3 rollos de cable"
Agente: agrega el cable y vuelve a mostrar el pedido.
```

Mientras el pedido está abierto, puede:

- Agregar materiales.
- Modificar cantidades, unidades o descripciones.
- Quitar materiales.
- Limpiar el pedido completo para comenzar de nuevo.
- Consultar el pedido actual.

Si agrega nuevamente un material equivalente, el agente acumula las cantidades siempre
que pueda identificar un único material compatible.

```text
Pedido actual: 30 bolsas de cemento
Encargado: "Agrega 10 bolsas de cemento"
Resultado: 40 bolsas de cemento
```

### Cantidades faltantes

El encargado puede mencionar un material sin indicar la cantidad. El agente permite
continuar con la carga y solicita los datos faltantes al intentar cerrar el pedido.

```text
Encargado: "Necesito puertas y 10 bolsas de cemento"
Encargado: "listo"
Agente: "¿Qué cantidad de puertas necesita?"
Encargado: "2"
Agente: muestra el resumen final y solicita `CONFIRMAR`.
```

Si hay varias cantidades faltantes, las pregunta de a una.

### Envío del pedido

Expresiones como `"listo"`, `"cerrar"` o `"eso es todo"` indican que el encargado terminó
la carga. El agente valida los materiales y muestra el resumen final.

```text
Encargado: "listo"
Agente: muestra el pedido para confirmar.

Encargado: "CONFIRMAR"
Agente: guarda el pedido y cierra el proceso.
```

Solo `CONFIRMAR` guarda el pedido. Respuestas como `"sí"`, `"ok"`, `"dale"` o
`"confirmo"` no lo envían directamente.

### Pedido anterior sin finalizar

Si existe un pedido abierto sin finalizar y transcurrieron más de 60 minutos desde el
último cambio, el agente evita mezclarlo silenciosamente con un pedido nuevo. Al recibir
el siguiente mensaje ofrece continuar el pedido anterior o empezar otro.

```text
Agente: "Tiene un pedido previo sin finalizar.
        Responda continuar para retomarlo o nuevo para empezar otro."
```

El encargado también puede iniciar otro pedido y dictar materiales en el mismo mensaje:

```text
Encargado: "Nuevo, necesito 5 bolsas de cemento"
```

## Parte diario de asistencia

### Carga del parte

El encargado informa las novedades del personal en lenguaje normal. Puede incluir varias
personas en el mismo mensaje:

```text
Encargado: "Faltó García, Pérez hizo 3 horas extra y Medina trabajó 5 horas por lluvia"
Agente: registra las novedades y muestra un resumen.
```

Los empleados asignados al proyecto que no son mencionados se registran automáticamente
como presentes al confirmar el parte.

### Parte sin novedades

Si todos estuvieron presentes, el encargado debe indicarlo explícitamente:

```text
Encargado: "Todos presentes"
Agente: registra asistencia completa y solicita `CONFIRMAR`.
```

Abrir el proceso y escribir `CONFIRMAR` sin informar novedades no genera un parte de
presentes automáticamente. El agente solicita informar las novedades o indicar que todos
estuvieron presentes.

Si ya se registraron novedades y luego el encargado escribe `"Todos presentes"`, el
agente conserva lo cargado y solicita una aclaración. No elimina novedades
automáticamente.

### Fecha del parte

Si no se menciona una fecha, el agente utiliza el día actual. El encargado también puede
informar otra fecha:

```text
Encargado: "Ayer faltó García"
```

Si ya existe un borrador para esa fecha, el agente lo retoma para permitir correcciones.
Si el parte ya fue cerrado por administración, informa que no puede modificarse desde
WhatsApp.

Si el encargado retomó un borrador y luego solicita cambiar su fecha, el agente pide una
confirmación explícita antes de trasladar las novedades cargadas. El borrador original no
se modifica automáticamente.

### Horas y novedades

Para empleados asignados al proyecto:

| Situación | Registro |
|-----------|----------|
| Empleado no mencionado | Presente, 9 horas |
| Presente sin horas informadas | Presente, 9 horas |
| Horas extra | Presente, 9 horas más las horas extra |
| Ausencia total | 0 horas y motivo correspondiente |
| Jornada menor a 9 horas | Horas trabajadas y motivo correspondiente |

Si falta el motivo de una ausencia o de una jornada parcial, el agente lo solicita antes
de guardar el parte.

### Personal de otro proyecto

También se puede registrar personal asignado habitualmente a otro proyecto cuando trabaja
en la obra informada.

En ese caso:

- Si no se informan horas, se registran `9` horas.
- Si se informan menos de `9` horas, se registran sin solicitar el motivo.
- No se genera un presente automático.
- El resumen identifica que la persona pertenece a otro proyecto.

### Aclaraciones

El agente permite informar todas las novedades sin interrumpir la carga. Al intentar
confirmar, solicita las aclaraciones pendientes de a una.

El resumen muestra tanto las novedades resueltas como las personas pendientes de
aclaración. Por ejemplo: `Varela: FAL (pendiente de aclarar la persona)`.

Puede preguntar:

- A cuál persona se refiere, si encuentra varios nombres posibles.
- Qué motivo corresponde, si la novedad no permite determinarlo.

Ejemplo:

```text
Agente: "¿Qué le pasó a Rafael?
        1) ACCIDENTE
        2) ENFERMEDAD
        3) LICENCIA
        4) VACACIONES
        5) PERMISO
        6) LLUVIA
        7) FALTA"

Encargado: "1"
```

El encargado puede responder con el número, el nombre de la opción o una frase breve. Si
la respuesta sigue siendo ambigua, el agente vuelve a mostrar las opciones.

### Dos novedades para la misma persona

Un parte diario admite como máximo una novedad explícita por persona. Si el encargado
informa dos situaciones para el mismo empleado, el agente no elige automáticamente:
las conserva como alternativas pendientes, permite continuar la carga y solicita
seleccionar cuál debe registrarse cuando el encargado escribe `CONFIRMAR`.

```text
Encargado: "Pérez hizo 3 horas extra y Pérez García tuvo un accidente"
Agente: muestra el resumen e informa que hay un conflicto pendiente.

Encargado: "CONFIRMAR"
Agente: "Pérez García fue mencionado más de una vez:
        1) Trabajó 3 horas extra.
        2) Tuvo un accidente.
        ¿Qué novedad desea registrar?"

Encargado: "2"
```

### Confirmación y correcciones

Al terminar, el agente muestra el resumen y solicita `CONFIRMAR`. Si todavía hay
aclaraciones pendientes, las resuelve primero y vuelve a mostrar el resumen final.

```text
Encargado: "eso es todo"
Agente: muestra el resumen.

Encargado: "CONFIRMAR"
Agente: guarda el parte y cierra el proceso.
```

El agente guarda el parte como borrador editable. Administración puede cerrarlo
posteriormente. Si el encargado retoma un borrador y confirma una corrección, la nueva
versión reemplaza el detalle anterior del borrador.

## Resumen operativo

| Necesidad | Qué escribir |
|-----------|--------------|
| Iniciar un pedido | `"Necesito 10 bolsas de cemento"` |
| Finalizar la carga de un pedido | `"listo"` |
| Informar novedades de asistencia | `"Faltó García y Pérez hizo 2 horas extra"` |
| Informar asistencia completa | `"Todos presentes"` |
| Guardar el proceso activo | `CONFIRMAR` |
| Descartar el proceso activo | `CANCELAR` |
| Consultar la nómina | `"Mostrame la nómina"` |
| Consultar el parte del día | `"Mostrame el parte de hoy"` |

La regla principal es simple: primero se carga y valida la información; luego se escribe
`CONFIRMAR` para guardarla.
