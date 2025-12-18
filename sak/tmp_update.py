# -*- coding: utf-8 -*-
from pathlib import Path
path = Path('doc/03-devs/20251218-meta_w_reciept/spec.md')
text = path.read_text()
old = "## Objetivos del desarrollo\n\n1. Aヵadir un router dedicado para procesar eventos de meta-w y que `meta-w` pueda configurar como su `webhook_url`.\n2. Mapear cada tipo de evento (`message.received`, `message.sent`, `message.delivered`, `message.read`, `message.failed`) a las actualizaciones correspondientes en `CRMMensaje`.\n3. Garantizar que el endpoint responde `200 OK` incluso si el mensaje ya existe o si hay errores de procesamiento, para evitar reintentos de meta-w.\n4. Permitir que la configuración del webhook (URL) se actualice en la tabla `empresas` y que el equipo de DevOps pueda validarla mediante el endpoint de testing existente.\n"
new = "## Objetivos del desarrollo\n\n1. Aヵadir un router dedicado para procesar eventos de meta-w y que `meta-w` pueda configurar como su `webhook_url`.\n2. Mapear cada tipo de evento (`message.received`, `message.sent`, `message.delivered`, `message.read`, `message.failed`) a las actualizaciones correspondientes en `CRMMensaje` sin alterar la lógica actual de estados de `sak`, pero incorporando un campo adicional que refleje el estado reportado por Meta.\n3. Garantizar que el endpoint responde `200 OK` incluso si el mensaje ya existe o si hay errores de procesamiento, para evitar reintentos de meta-w.\n4. Permitir que la configuración del webhook (URL) se actualice en la tabla `empresas` y que el equipo de DevOps pueda validarla mediante el endpoint de testing existente.\n"
if old not in text:
    raise SystemExit('old block not found')
text = text.replace(old, new, 1)
old_row = "| RF-5 | Para `message.failed` registrar el `error_code` y `error_message` en `metadata_json` y marcar el mensaje como `ERROR_ENVIO`. |"
new_row = "| RF-5 | Para `message.failed` registrar el `error_code` y `error_message` en `metadata_json`, actualizar el campo de estado Meta y marcar el mensaje como `ERROR_ENVIO`. |"
if old_row not in text:
    raise SystemExit('old row not found')
text = text.replace(old_row, new_row, 1)
path.write_text(text)
