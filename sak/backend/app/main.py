from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
import logging
import traceback

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
from app.routers.tipo_comprobante_router import tipo_comprobante_router
from app.routers.tipo_propiedad_router import router as tipo_propiedad_router
from app.routers.metodo_pago_router import metodo_pago_router
from app.routers.propiedad_router import propiedad_router
from app.routers.setting_router import setting_router
from app.routers.articulo_router import articulo_router
from app.routers.factura_router import factura_router
from app.routers.factura_detalle_router import factura_detalle_router
from app.routers.factura_impuesto_router import factura_impuesto_router
from app.routers.departamento_router import departamento_router
from app.routers.tipo_solicitud_router import tipo_solicitud_router
from app.routers.solicitud_router import solicitud_router
from app.routers.solicitud_detalle_router import solicitud_detalle_router
from app.routers.centro_costo_router import centro_costo_router
from app.routers.proyecto_router import proyecto_router
from app.routers.nomina_router import nomina_router
from app.routers.partediario_router import parte_diario_router
from app.routers.vacancia_router import vacancia_router
from app.routers.vacancia_dashboard_router import router as vacancia_dashboard_router
from app.routers.crm_dashboard_router import router as crm_dashboard_router
from app.routers.cliente_router import router as cliente_router
from app.routers.crm import (
    crm_tipo_operacion_router,
    crm_motivo_perdida_router,
    crm_condicion_pago_router,
    crm_tipo_evento_router,
    crm_motivo_evento_router,
    crm_origen_lead_router,
    moneda_router,
    crm_moneda_router,
    cotizacion_moneda_router,
    cotizacion_conversion_router,
    crm_contacto_router,
    crm_oportunidad_router,
    crm_evento_router,
    crm_mensaje_router,
)
from app.routers.crm_celular_router import router as crm_celular_router
from app.routers.meta_webhook_router import router as meta_webhook_router
from app.api.upload import router as upload_router
from app.api.factura_processing import router as factura_processing_router
from app.api.auth import router as auth_router
from app.routers.file_proxy import router as file_proxy_router
from app.routers.emprendimiento_router import emprendimiento_router

app = FastAPI(title="API genérica con FastAPI + SQLModel")

# Configure CORS - Dynamic origins from environment or defaults
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    # Production: usar orígenes desde variable de entorno
    # Soportar tanto coma (,) como punto y coma (;) como separadores
    separator = ";" if ";" in cors_origins_env else ","
    allowed_origins = [origin.strip() for origin in cors_origins_env.split(separator)]
    logger.info(f"CORS configurado para producción: {allowed_origins}")
else:
    # Development: usar localhost
    allowed_origins = [
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3001"
    ]
    logger.info(f"CORS configurado para desarrollo: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range"],  # Para ra-data-simple-rest
    max_age=60,  # Cachear preflight solo 60 segundos (evita problemas con actualizaciones)
)

# Global exception handler para asegurar headers CORS en errores 500
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Captura todas las excepciones no manejadas y retorna una respuesta 500
    con headers CORS correctos para evitar bloqueos del navegador.
    """
    logger.error(f"Unhandled exception: {exc}")
    logger.error(traceback.format_exc())
    
    # Obtener el origin del request
    origin = request.headers.get("origin")
    
    # Crear respuesta de error
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
    
    # Agregar headers CORS manualmente si el origin está permitido
    if origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Expose-Headers"] = "Content-Range"
    
    return response

# Registrar routers
app.include_router(item_router)
app.include_router(user_router)
app.include_router(auth_router, prefix="/api")  # Agregar router auth
app.include_router(upload_router, prefix="/api")
app.include_router(factura_processing_router, prefix="/api/v1")
app.include_router(file_proxy_router, prefix="/api")
app.include_router(pais_router)
app.include_router(tarea_router)
app.include_router(proveedor_router)
app.include_router(tipo_operacion_router)
app.include_router(tipo_comprobante_router)
app.include_router(tipo_propiedad_router)
app.include_router(metodo_pago_router)
app.include_router(propiedad_router)
app.include_router(setting_router)
app.include_router(articulo_router)
app.include_router(factura_router)
app.include_router(factura_detalle_router)
app.include_router(factura_impuesto_router)
app.include_router(departamento_router)
app.include_router(tipo_solicitud_router)
app.include_router(solicitud_router)
app.include_router(solicitud_detalle_router)
app.include_router(centro_costo_router)
app.include_router(vacancia_router)
app.include_router(vacancia_dashboard_router)
app.include_router(crm_dashboard_router)
app.include_router(cliente_router)
app.include_router(crm_tipo_operacion_router)
app.include_router(crm_motivo_perdida_router)
app.include_router(crm_condicion_pago_router)
app.include_router(crm_tipo_evento_router)
app.include_router(crm_motivo_evento_router)
app.include_router(crm_origen_lead_router)
app.include_router(moneda_router)
app.include_router(crm_moneda_router)
app.include_router(cotizacion_conversion_router)
app.include_router(cotizacion_moneda_router)
app.include_router(crm_contacto_router)
app.include_router(crm_oportunidad_router)
app.include_router(crm_evento_router)
app.include_router(crm_mensaje_router)
app.include_router(crm_celular_router)
app.include_router(meta_webhook_router, prefix="/api")
app.include_router(emprendimiento_router)
app.include_router(proyecto_router)
app.include_router(nomina_router)
app.include_router(parte_diario_router)

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
