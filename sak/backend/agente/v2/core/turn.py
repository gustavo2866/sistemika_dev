# Modulo reemplazado - los tipos ahora viven en sus modulos especificos.
# Este archivo solo existe para que imports antiguos no rompan en produccion.
from agente.v2.core.state import utc_now_iso as utc_now_iso  # noqa: F401
from agente.v2.core.delivery import SendResult as SendResult, SendTextCommand as SendTextCommand  # noqa: F401
