from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
import logging
import traceback

# Configurar logging xxx223344
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
from app.routers.servicio_tipo_router import router as servicio_tipo_router
from app.routers.propiedad_servicio_router import router as propiedad_servicio_router
from app.routers.metodo_pago_router import metodo_pago_router
from app.routers.propiedad_router import propiedad_router
from app.routers.propiedades_status_router import propiedades_status_router
from app.routers.propiedades_log_status_router import propiedades_log_status_router
from app.routers.setting_router import setting_router
from app.routers.crm_chat_agent_router import router as crm_chat_agent_router
from app.routers.articulo_router import articulo_router
from app.routers.tipo_articulo_router import tipo_articulo_router
from app.routers.factura_router import factura_router
from app.routers.factura_detalle_router import factura_detalle_router
from app.routers.factura_impuesto_router import factura_impuesto_router
from app.routers.comprobante_router import comprobante_router, file_router
from app.routers.departamento_router import departamento_router
from app.routers.tipo_solicitud_router import tipo_solicitud_router
from app.routers.tipo_actualizacion_router import tipo_actualizacion_router
from app.routers.tipo_contrato_router import tipo_contrato_router
from app.routers.contrato_router import contrato_router
from app.routers.centro_costo_router import centro_costo_router
from app.routers.propietario_router import propietario_router
from app.routers.proyecto_router import proyecto_router
from app.routers.proyecto_avance_router import proyecto_avance_router
from app.routers.proy_fase_router import proy_fase_router
from app.routers.proy_presupuesto_router import proy_presupuesto_router
from app.routers.nomina_router import nomina_router
from app.routers.parte_diario_estado_router import parte_diario_estado_router
from app.routers.partediario_router import parte_diario_router
from app.routers.tarja_router import tarja_router
from app.routers.constructora_pedido_router import constructora_pedido_router

from app.routers.adm_concepto_router import adm_concepto_router
from app.routers.crm_dashboard_router import router as crm_dashboard_router
from app.routers.home_dashboard_router import router as home_dashboard_router
from app.routers.proyectos_dashboard_router import router as proyectos_dashboard_router
from app.routers.propiedades_dashboard_router import router as propiedades_dashboard_router
# Routers módulo de compras (PO)
from app.routers.po_invoice_router import po_invoice_router
from app.routers.po_invoice_status_router import po_invoice_status_router
from app.routers.po_invoice_status_fin_router import po_invoice_status_fin_router
from app.routers.po_order_router import po_order_router
from app.routers.po_order_detail_router import po_order_detail_router
from app.routers.po_order_status_router import po_order_status_router
from app.routers.po_order_status_log_router import po_order_status_log_router
from app.routers.po_bandeja_router import router as po_bandeja_router
from app.routers.po_dashboard_router import router as po_dashboard_router
from app.routers.tax_profile_router import tax_profile_router
from app.routers.crm import (
    crm_tipo_operacion_router,
    crm_motivo_perdida_router,
    crm_condicion_pago_router,
    crm_tipo_evento_router,
    crm_motivo_evento_router,
    crm_catalogo_respuesta_router,
    moneda_router,
    crm_moneda_router,
    cotizacion_moneda_router,
    cotizacion_conversion_router,
    crm_contacto_router,
    crm_oportunidad_router,
    crm_evento_router,
    crm_mensaje_router,
    crm_tipo_contacto_router,
)
from app.routers.crm_celular_router import router as crm_celular_router
from app.routers.channel_meta_webhook_router import router as channel_meta_webhook_router
from app.routers.agente_v3_router import router as agente_v3_router
from app.routers.calculadora_router import router as calculadora_router
from app.api.upload import router as upload_router
from app.api.factura_processing import router as factura_processing_router
from app.api.auth import router as auth_router
from app.routers.file_proxy import router as file_proxy_router
from app.routers.emprendimiento_router import emprendimiento_router

app = FastAPI(title="API genérica con FastAPI + SQLModel")

# Configure CORS - Dynamic origins from environment or defaults
cors_origins_env = os.getenv("CORS_ORIGINS", "")
cors_origins_regex = os.getenv("CORS_ORIGINS_REGEX", None)
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
    allow_origin_regex=cors_origins_regex,
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
app.include_router(servicio_tipo_router)
app.include_router(propiedad_servicio_router)
app.include_router(metodo_pago_router)
app.include_router(propiedad_router)
app.include_router(propiedades_status_router)
app.include_router(propiedades_log_status_router)
app.include_router(setting_router)
app.include_router(crm_chat_agent_router)
app.include_router(articulo_router)
app.include_router(tipo_articulo_router)
app.include_router(factura_router)
app.include_router(factura_detalle_router)
app.include_router(factura_impuesto_router)
app.include_router(comprobante_router)
app.include_router(file_router)
app.include_router(departamento_router)
app.include_router(tipo_solicitud_router)
app.include_router(tipo_actualizacion_router)
app.include_router(tipo_contrato_router)
app.include_router(contrato_router)
app.include_router(centro_costo_router)
app.include_router(propietario_router)

app.include_router(adm_concepto_router)
app.include_router(home_dashboard_router)
app.include_router(propiedades_dashboard_router)
app.include_router(crm_dashboard_router)
app.include_router(proyectos_dashboard_router)
app.include_router(crm_tipo_operacion_router)
app.include_router(crm_tipo_contacto_router)
app.include_router(crm_motivo_perdida_router)
app.include_router(crm_condicion_pago_router)
app.include_router(crm_tipo_evento_router)
app.include_router(crm_motivo_evento_router)
app.include_router(crm_catalogo_respuesta_router)
app.include_router(moneda_router)
app.include_router(crm_moneda_router)
app.include_router(cotizacion_conversion_router)
app.include_router(cotizacion_moneda_router)
app.include_router(crm_contacto_router)
app.include_router(crm_oportunidad_router)
app.include_router(crm_evento_router)
app.include_router(crm_mensaje_router)
app.include_router(crm_celular_router)
app.include_router(channel_meta_webhook_router, prefix="/api")
app.include_router(agente_v3_router, prefix="/api")
app.include_router(calculadora_router)
app.include_router(emprendimiento_router)
# Routers módulo de compras (PO)
app.include_router(po_invoice_router)
app.include_router(po_invoice_status_router)
app.include_router(po_invoice_status_fin_router)
app.include_router(po_order_router)
app.include_router(po_order_detail_router)
app.include_router(po_order_status_router)
app.include_router(po_order_status_log_router)
app.include_router(po_bandeja_router)
app.include_router(po_dashboard_router)
app.include_router(tax_profile_router)
app.include_router(proyecto_router)
app.include_router(proyecto_avance_router)
app.include_router(proy_fase_router)
app.include_router(proy_presupuesto_router)
app.include_router(nomina_router)
app.include_router(parte_diario_estado_router)
app.include_router(parte_diario_router)
app.include_router(tarja_router)
app.include_router(constructora_pedido_router)

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
async def on_startup():
    init_db()

@app.on_event("shutdown")
async def on_shutdown():
    pass

@app.get("/health")
def health():
    import socket
    return {
        "status": "ok",
        "llm_model": os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini"),
        "region": os.getenv("CLOUD_RUN_REGION", os.getenv("GCP_REGION", "local")),
        "hostname": socket.gethostname(),
    }


@app.get("/diagnostics/llm-latency")
async def llm_latency_probe():
    """Mide la latencia de red pura a la API de OpenAI (sin inferencia LLM)."""
    import socket
    import ssl
    import time

    results: dict = {"host": "api.openai.com", "port": 443}

    # DNS
    t0 = time.perf_counter()
    try:
        addr = socket.getaddrinfo("api.openai.com", 443, socket.AF_INET, socket.SOCK_STREAM)[0][4][0]
        results["dns_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        results["resolved_ip"] = addr
    except Exception as exc:
        results["dns_error"] = str(exc)
        return results

    # TCP connect
    t1 = time.perf_counter()
    try:
        sock = socket.create_connection(("api.openai.com", 443), timeout=5)
        results["tcp_ms"] = round((time.perf_counter() - t1) * 1000, 1)
    except Exception as exc:
        results["tcp_error"] = str(exc)
        return results

    # TLS handshake
    t2 = time.perf_counter()
    try:
        ctx = ssl.create_default_context()
        tls_sock = ctx.wrap_socket(sock, server_hostname="api.openai.com")
        results["tls_ms"] = round((time.perf_counter() - t2) * 1000, 1)
        tls_sock.close()
    except Exception as exc:
        results["tls_error"] = str(exc)
        sock.close()

    results["total_connect_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    results["llm_model"] = os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini")
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
