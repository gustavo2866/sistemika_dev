#!/usr/bin/env python3
"""
Script para analizar los modelos CRM y proporcionar métricas cuantitativas.
"""

import os
import re
import ast
from typing import Dict, List, Set, Tuple
from pathlib import Path

class CRMAnalyzer:
    def __init__(self, models_path: str):
        self.models_path = Path(models_path)
        self.crm_files = list(self.models_path.glob("crm_*.py"))
        self.analysis_data = {}
        
    def analyze_file(self, file_path: Path) -> Dict:
        """Analiza un archivo Python y extrae métricas."""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.splitlines()
        non_empty_lines = [line for line in lines if line.strip()]
        comment_lines = [line for line in lines if line.strip().startswith('#')]
        docstring_lines = self._count_docstring_lines(content)
        
        # Parsear el AST para extraer clases e imports
        try:
            tree = ast.parse(content)
            classes = self._extract_classes(tree)
            imports = self._extract_imports(tree)
            relationships = self._extract_relationships(content)
        except SyntaxError:
            classes = []
            imports = []
            relationships = []
        
        return {
            'file': file_path.name,
            'total_lines': len(lines),
            'non_empty_lines': len(non_empty_lines),
            'comment_lines': len(comment_lines),
            'docstring_lines': docstring_lines,
            'code_lines': len(non_empty_lines) - len(comment_lines) - docstring_lines,
            'classes': classes,
            'imports': imports,
            'relationships': relationships
        }
    
    def _count_docstring_lines(self, content: str) -> int:
        """Cuenta líneas de docstrings."""
        docstring_pattern = r'"""[\s\S]*?"""'
        docstrings = re.findall(docstring_pattern, content)
        total_lines = 0
        for docstring in docstrings:
            total_lines += len(docstring.splitlines())
        return total_lines
    
    def _extract_classes(self, tree: ast.AST) -> List[Dict]:
        """Extrae información de clases del AST."""
        classes = []
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                # Buscar herencia de Base
                base_classes = [base.id for base in node.bases if isinstance(base, ast.Name)]
                
                # Contar atributos/campos
                fields = []
                for child in node.body:
                    if isinstance(child, ast.AnnAssign) and isinstance(child.target, ast.Name):
                        fields.append(child.target.id)
                
                # Contar métodos
                methods = []
                for child in node.body:
                    if isinstance(child, ast.FunctionDef):
                        methods.append(child.name)
                
                classes.append({
                    'name': node.name,
                    'base_classes': base_classes,
                    'fields_count': len(fields),
                    'methods_count': len(methods),
                    'fields': fields,
                    'methods': methods
                })
        return classes
    
    def _extract_imports(self, tree: ast.AST) -> List[str]:
        """Extrae imports del AST."""
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    for alias in node.names:
                        imports.append(f"{node.module}.{alias.name}")
        return imports
    
    def _extract_relationships(self, content: str) -> List[Dict]:
        """Extrae relaciones SQLAlchemy/SQLModel del contenido."""
        relationships = []
        
        # Buscar patrones de Relationship
        relationship_pattern = r'(\w+):\s*(?:Optional\[)?(?:list\[)?["\']?(\w+)["\']?\]?\]?\s*=\s*Relationship\('
        matches = re.findall(relationship_pattern, content)
        
        for match in matches:
            field_name, related_model = match
            relationships.append({
                'field': field_name,
                'related_model': related_model,
                'type': 'list' if 'list[' in content else 'single'
            })
        
        # Buscar foreign keys
        fk_pattern = r'(\w+):\s*(?:Optional\[)?int\]?\s*=\s*Field\([^)]*foreign_key=["\']([^"\']+)["\']'
        fk_matches = re.findall(fk_pattern, content)
        
        for match in fk_matches:
            field_name, fk_table = match
            relationships.append({
                'field': field_name,
                'foreign_key': fk_table,
                'type': 'foreign_key'
            })
        
        return relationships
    
    def analyze_all_files(self):
        """Analiza todos los archivos CRM."""
        for file_path in self.crm_files:
            self.analysis_data[file_path.name] = self.analyze_file(file_path)
    
    def generate_report(self) -> str:
        """Genera un reporte completo del análisis."""
        if not self.analysis_data:
            self.analyze_all_files()
        
        report = []
        report.append("# ANÁLISIS CUANTITATIVO DE MODELOS CRM")
        report.append("=" * 50)
        report.append("")
        
        # 1. Métricas generales de líneas de código
        total_lines = sum(data['total_lines'] for data in self.analysis_data.values())
        total_code_lines = sum(data['code_lines'] for data in self.analysis_data.values())
        total_files = len(self.analysis_data)
        
        report.append("## 1. MÉTRICAS DE CÓDIGO")
        report.append(f"- Total de archivos CRM: {total_files}")
        report.append(f"- Total de líneas: {total_lines}")
        report.append(f"- Líneas de código efectivo: {total_code_lines}")
        report.append(f"- Promedio de líneas por archivo: {total_lines / total_files:.1f}")
        report.append("")
        
        # Desglose por archivo
        report.append("### Desglose por archivo:")
        for filename, data in sorted(self.analysis_data.items()):
            report.append(f"- {filename}: {data['total_lines']} líneas total, {data['code_lines']} líneas código")
        report.append("")
        
        # 2. Análisis de clases/modelos
        all_classes = []
        for data in self.analysis_data.values():
            all_classes.extend(data['classes'])
        
        total_classes = len(all_classes)
        
        report.append("## 2. CLASES Y MODELOS")
        report.append(f"- Total de clases/modelos: {total_classes}")
        report.append("")
        
        # Desglose de clases
        report.append("### Modelos identificados:")
        for filename, data in sorted(self.analysis_data.items()):
            if data['classes']:
                report.append(f"\n**{filename}:**")
                for cls in data['classes']:
                    report.append(f"  - {cls['name']}: {cls['fields_count']} campos, {cls['methods_count']} métodos")
        
        # 3. Análisis de dependencias e imports
        all_imports = set()
        crm_imports = set()
        
        for data in self.analysis_data.values():
            for imp in data['imports']:
                all_imports.add(imp)
                if 'crm_' in imp or any(cls['name'] for cls_data in self.analysis_data.values() for cls in cls_data['classes'] if cls['name'] in imp):
                    crm_imports.add(imp)
        
        report.append("\n\n## 3. ANÁLISIS DE DEPENDENCIAS")
        report.append(f"- Total de imports únicos: {len(all_imports)}")
        report.append(f"- Imports relacionados con CRM: {len(crm_imports)}")
        report.append("")
        
        # Principales dependencias externas
        external_deps = set()
        for imp in all_imports:
            if not imp.startswith('.') and not imp.startswith('app.'):
                main_module = imp.split('.')[0]
                external_deps.add(main_module)
        
        report.append("### Principales dependencias externas:")
        for dep in sorted(external_deps):
            report.append(f"- {dep}")
        report.append("")
        
        # 4. Análisis de relaciones
        all_relationships = []
        for data in self.analysis_data.values():
            all_relationships.extend(data['relationships'])
        
        total_relationships = len(all_relationships)
        foreign_keys = [rel for rel in all_relationships if rel['type'] == 'foreign_key']
        one_to_many = [rel for rel in all_relationships if rel['type'] == 'list']
        one_to_one = [rel for rel in all_relationships if rel['type'] == 'single']
        
        report.append("## 4. COMPLEJIDAD DE RELACIONES")
        report.append(f"- Total de relaciones: {total_relationships}")
        report.append(f"- Foreign keys: {len(foreign_keys)}")
        report.append(f"- Relaciones uno-a-muchos: {len(one_to_many)}")
        report.append(f"- Relaciones uno-a-uno: {len(one_to_one)}")
        report.append("")
        
        # Análisis de acoplamiento
        relationship_map = {}
        for filename, data in self.analysis_data.items():
            model_name = filename.replace('.py', '').replace('crm_', '').title()
            relationships_out = len(data['relationships'])
            relationship_map[model_name] = relationships_out
        
        report.append("### Acoplamiento por modelo:")
        for model, count in sorted(relationship_map.items(), key=lambda x: x[1], reverse=True):
            report.append(f"- {model}: {count} relaciones")
        report.append("")
        
        # 5. Resumen de complejidad
        complexity_score = total_classes + total_relationships + len(crm_imports)
        
        report.append("## 5. RESUMEN DE COMPLEJIDAD")
        report.append(f"- Score de complejidad total: {complexity_score}")
        report.append(f"  (Clases: {total_classes} + Relaciones: {total_relationships} + Deps CRM: {len(crm_imports)})")
        report.append(f"- Nivel de acoplamiento: {'Alto' if total_relationships > 50 else 'Medio' if total_relationships > 20 else 'Bajo'}")
        report.append(f"- Mantenibilidad: {'Baja' if complexity_score > 100 else 'Media' if complexity_score > 50 else 'Alta'}")
        
        return "\n".join(report)

def main():
    models_path = "app/models"
    analyzer = CRMAnalyzer(models_path)
    report = analyzer.generate_report()
    print(report)

if __name__ == "__main__":
    main()