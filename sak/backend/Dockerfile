# Dockerfile para Cloud Run
FROM python:3.12-slim

# Variables de entorno
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Directorio de trabajo
WORKDIR /app

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar aplicación
COPY . .

# Exponer puerto
EXPOSE 8080

# Comando de inicio
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
