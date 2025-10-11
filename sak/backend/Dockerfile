FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY . .

# Crear directorio para uploads
RUN mkdir -p uploads/facturas

# Exponer puerto (Cloud Run usa PORT env var)
EXPOSE 8080

# Comando de inicio que usa la variable de entorno PORT (Cloud Run la setea en 8080)
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
