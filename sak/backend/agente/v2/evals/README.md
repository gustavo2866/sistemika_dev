# Evals del agente v1

Datasets sinteticos y anonimizados para evaluar los schemas LLM antes del rollout.

- `general_intents.jsonl`: seleccion del subproceso o consulta general.
- `pedido_obra_operations.jsonl`: operaciones estructuradas de materiales.
- `parte_diario_operations.jsonl`: extraccion de novedades y controles de asistencia.
- `parte_diario_estado_pendiente.jsonl`: fallback acotado para resolver motivos.

Cada linea contiene `input` y `expected`. Los datasets no ejecutan llamadas externas
durante pytest. Deben utilizarse en smoke tests de Neon test con el modelo configurado
antes de habilitar el rollout.

Ejecutar contra el proveedor:

```powershell
python scripts/run_agent_v1_llm_evals.py
```

El runner requiere `OPENAI_API_KEY`, realiza llamadas externas y devuelve exit code `1`
si algun caso no coincide con el resultado esperado.
