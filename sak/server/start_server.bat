@echo off
cd /d "C:\Users\gpalmieri\source\sistemika\sak\server"
echo Iniciando servidor desde directorio correcto...
echo Directorio actual: %CD%
uvicorn app.main:app --reload --log-level info
