import logging
from typing import Dict
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select

from app.models.compras import PoInvoice, PoInvoiceDetalle
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.core.responses import ErrorCodes
from app.models.base import current_utc_time, filtrar_respuesta

logger = logging.getLogger(__name__)

# CRUD con relación anidada para detalles de facturas
po_invoice_crud = NestedCRUD(
    PoInvoice,
    nested_relations={
        "detalles": {
            "model": PoInvoiceDetalle,
            "fk_field": "invoice_id",
            "allow_delete": True,
        }
    },
)

# Router genérico para facturas (PO Invoice)
po_invoice_router = create_generic_router(
    model=PoInvoice,
    crud=po_invoice_crud,
    prefix="/po-invoices",
    tags=["po-invoices"],
)