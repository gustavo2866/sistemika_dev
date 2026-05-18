"""
Benchmark de latencia pura del LLM (sin logica de agente).

Modos:
  python tests/bench_model.py            -> saludo simple, N=3
  python tests/bench_model.py materiales -> prompt real del agente, N=3
  python tests/bench_model.py saludo 5   -> saludo, 5 iteraciones
"""
import os, sys, time, statistics
from pathlib import Path

# Leer API key: primero .env, si no, open_ai_key.txt
key_file = Path(__file__).resolve().parents[1] / "open_ai_key.txt"
env_file = Path(__file__).resolve().parents[1] / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("OPENAI_API_KEY="):
            os.environ["OPENAI_API_KEY"] = line.split("=", 1)[1].strip()
            break
elif key_file.exists():
    os.environ["OPENAI_API_KEY"] = key_file.read_text().strip()

from openai import OpenAI
client = OpenAI()

# --- Configuracion ---
modo = sys.argv[1] if len(sys.argv) > 1 else "saludo"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 3
MODELS = ["gpt-4o-mini", "gpt-4.1-mini"]

if modo == "materiales":
    SYSTEM = "Extrae materiales de construccion y devuelve JSON."
    USER = '{"mensaje": "necesito 50 bolsas de cemento y arena fina", "solicitud_actual": [], "familias": [{"codigo": "cementicios", "tags": ["cemento"]}, {"codigo": "aridos", "tags": ["arena"]}]}'
    response_format = {"type": "json_object"}
    max_tokens = 200
else:
    # Saludo puro — sin JSON, sin logica
    SYSTEM = "Eres un asistente."
    USER = "hola como estas"
    response_format = None
    max_tokens = 50

print(f"Modo: {modo} | Iteraciones: {N}")
print("-" * 45)

for model in MODELS:
    times = []
    for i in range(N):
        t = time.time()
        try:
            kwargs = dict(
                model=model,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": USER},
                ],
            )
            if response_format:
                kwargs["response_format"] = response_format
            r = client.chat.completions.create(**kwargs)
            elapsed = time.time() - t
            times.append(elapsed)
            print(f"  {model} #{i+1}: {elapsed:.2f}s")
        except Exception as e:
            print(f"  {model} #{i+1}: ERROR {e}")

    if times:
        avg = statistics.mean(times)
        mn = min(times)
        mx = max(times)
        print(f"  {model} => min={mn:.2f}s  avg={avg:.2f}s  max={mx:.2f}s")
    print()
