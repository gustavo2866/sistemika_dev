#!/usr/bin/env python3
"""
Script simple para debugear extracción de PDF
"""
import sys
import os
from pathlib import Path

# Añadir el directorio app al path
current_dir = Path(__file__).parent
app_dir = current_dir / "app"
sys.path.insert(0, str(app_dir))

try:
    import pdfplumber
    
    # Buscar el PDF
    facturas_dir = "uploads/facturas"
    pdf_files = [f for f in os.listdir(facturas_dir) if f.endswith('20222387753_011_00002_00000553.pdf')]
    
    if pdf_files:
        pdf_file = sorted(pdf_files)[-1]
        pdf_path = os.path.join(facturas_dir, pdf_file)
        
        print(f"Analizando: {pdf_file}")
        print("=" * 50)
        
        # Extraer texto
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                text = page.extract_text()
                if text:
                    print(f"\n--- PÁGINA {page_num} ---")
                    lines = text.split('\n')
                    for i, line in enumerate(lines[:20], 1):  # Solo primeras 20 líneas
                        if line.strip():
                            print(f"{i:2d}: {line}")
                    
                    if len(lines) > 20:
                        print(f"... y {len(lines) - 20} líneas más")
    else:
        print("No se encontró el PDF")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
