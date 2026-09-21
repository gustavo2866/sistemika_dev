"""Flujos conversacionales de parte diario.

El handler despacha por etapa y cada flujo establece su siguiente estado.
Una respuesta de texto termina el turno; continuar.procesar devuelve None
cuando acepta otra fecha y el handler debe seguir en el mismo turno.
Las consultas y escrituras del modelo se delegan a domain, y los textos a utils.
"""
