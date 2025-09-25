Pruebas para la API

- `test.py`: script Python que realiza un smoke test (usa la libreria `requests`).
- `run_curl_tests.ps1`: script PowerShell que ejecuta un par de comandos curl.

Cómo ejecutar (PowerShell):

```powershell
# activar virtualenv si corresponde
python -m pip install requests
python tests/test.py
# o
.\tests\run_curl_tests.ps1
```
