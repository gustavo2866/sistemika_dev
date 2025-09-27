from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cargar variables de entorno desde .env
load_dotenv()

# Verificar que las variables de entorno se cargaron
openai_key = os.getenv("OPENAI_API_KEY")
if openai_key:
    logger.info(f"OPENAI_API_KEY cargada: {'*' * (len(openai_key) - 10)}{openai_key[-10:]}")
else:
    logger.warning("OPENAI_API_KEY no configurada")

from app.db import init_db
from app.routers.item_router import item_router
from app.routers.user_router import user_router
from app.routers.pais_router import pais_router
from app.routers.tarea_router import tarea_router
from app.routers.proveedor_router import proveedor_router
from app.routers.tipo_operacion_router import tipo_operacion_router
from app.routers.factura_router import factura_router
from app.routers.factura_detalle_router import factura_detalle_router
from app.routers.factura_impuesto_router import factura_impuesto_router
from app.routers.cliente_router import router as cliente_router
from app.api.upload import router as upload_router
from app.api.factura_processing import router as factura_processing_router
from app.api.auth import router as auth_router

app = FastAPI(title="API genérica con FastAPI + SQLModel")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range"],  # Cambiado para ra-data-simple-rest
)

# Registrar routers
app.include_router(item_router)
app.include_router(user_router)
app.include_router(auth_router, prefix="/api")  # Agregar router auth
app.include_router(upload_router, prefix="/api")
app.include_router(factura_processing_router, prefix="/api/v1")
app.include_router(pais_router)
app.include_router(tarea_router)
app.include_router(proveedor_router)
app.include_router(tipo_operacion_router)
app.include_router(factura_router)
app.include_router(factura_detalle_router)
app.include_router(factura_impuesto_router)
app.include_router(cliente_router)

# Servir archivos estáticos (uploads)
uploads_dir = "uploads"
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir)

# Crear subdirectorios si no existen
for subdir in ["images", "facturas", "temp"]:
    subdir_path = os.path.join(uploads_dir, subdir)
    if not os.path.exists(subdir_path):
        os.makedirs(subdir_path)

# Montar rutas estáticas
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
