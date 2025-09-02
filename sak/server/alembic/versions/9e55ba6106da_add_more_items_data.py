"""add_more_items_data

Revision ID: 9e55ba6106da
Revises: 
Create Date: 2025-08-31 17:59:41.799944

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e55ba6106da'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


"""add_more_items_data

Revision ID: 9e55ba6106da
Revises:
Create Date: 2025-08-31 17:59:41.799944

"""
from typing import Sequence, Union
from datetime import datetime, timedelta
import random

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e55ba6106da'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Agregar más registros de prueba a la tabla items"""

    # Datos adicionales de items para insertar
    additional_items = [
        # Más productos tecnológicos
        {
            'name': 'iPad Pro 12.9"',
            'description': 'Tablet profesional con Apple Pencil Pro',
            'price': 1099.99,
            'category': 'Tecnología',
            'stock': 7,
            'user_id': 1,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },
        {
            'name': 'Samsung Galaxy Tab S9',
            'description': 'Tablet Android premium con S Pen',
            'price': 799.99,
            'category': 'Tecnología',
            'stock': 9,
            'user_id': 2,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },
        {
            'name': 'Mac Mini M2',
            'description': 'Mini PC de escritorio Apple con chip M2',
            'price': 599.99,
            'category': 'Tecnología',
            'stock': 5,
            'user_id': 1,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },

        # Más productos de gaming
        {
            'name': 'Nintendo Switch OLED',
            'description': 'Consola híbrida con pantalla OLED mejorada',
            'price': 349.99,
            'category': 'Gaming',
            'stock': 12,
            'user_id': 4,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },
        {
            'name': 'Sony PlayStation Portal',
            'description': 'Dispositivo remoto para PlayStation 5',
            'price': 199.99,
            'category': 'Gaming',
            'stock': 8,
            'user_id': 4,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },

        # Más productos de fotografía
        {
            'name': 'Canon EOS R5',
            'description': 'Cámara mirrorless profesional 45MP',
            'price': 3899.99,
            'category': 'Fotografía',
            'stock': 2,
            'user_id': 3,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },
        {
            'name': 'Nikon Zf',
            'description': 'Cámara mirrorless con diseño retro',
            'price': 1999.99,
            'category': 'Fotografía',
            'stock': 4,
            'user_id': 3,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },

        # Más productos de hogar
        {
            'name': 'Echo Dot (5ª Gen)',
            'description': 'Altavoz inteligente con Alexa',
            'price': 49.99,
            'category': 'Hogar',
            'stock': 25,
            'user_id': 2,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },
        {
            'name': 'Nest Thermostat',
            'description': 'Termostato inteligente para el hogar',
            'price': 249.99,
            'category': 'Hogar',
            'stock': 10,
            'user_id': 2,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },

        # Más productos de oficina
        {
            'name': 'Monitor LG 34WN650-W',
            'description': 'Monitor ultrawide 34" para productividad',
            'price': 449.99,
            'category': 'Oficina',
            'stock': 6,
            'user_id': 1,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },
        {
            'name': 'Teclado Logitech MX Keys',
            'description': 'Teclado inalámbrico para múltiples dispositivos',
            'price': 129.99,
            'category': 'Oficina',
            'stock': 15,
            'user_id': 1,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },

        # Más productos de deportes
        {
            'name': 'Apple Watch Ultra 2',
            'description': 'Reloj deportivo resistente para actividades extremas',
            'price': 799.99,
            'category': 'Deportes',
            'stock': 8,
            'user_id': 1,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },
        {
            'name': 'Garmin Fenix 7',
            'description': 'Reloj multideporte con GPS avanzado',
            'price': 699.99,
            'category': 'Deportes',
            'stock': 6,
            'user_id': 4,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },

        # Más productos de audio
        {
            'name': 'Sony WH-1000XM5',
            'description': 'Auriculares inalámbricos con cancelación de ruido premium',
            'price': 349.99,
            'category': 'Audio',
            'stock': 12,
            'user_id': 1,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },
        {
            'name': 'Bose QuietComfort Earbuds II',
            'description': 'Auriculares inalámbricos con cancelación de ruido',
            'price': 249.99,
            'category': 'Audio',
            'stock': 18,
            'user_id': 2,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },

        # Más productos de móviles
        {
            'name': 'Google Pixel 8 Pro',
            'description': 'Smartphone con IA avanzada y cámara excepcional',
            'price': 999.99,
            'category': 'Móviles',
            'stock': 7,
            'user_id': 2,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },
        {
            'name': 'OnePlus 12',
            'description': 'Smartphone con carga rápida y OxygenOS',
            'price': 849.99,
            'category': 'Móviles',
            'stock': 9,
            'user_id': 2,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },

        # Más productos de accesorios
        {
            'name': 'Base de carga MagSafe',
            'description': 'Base de carga inalámbrica para iPhone',
            'price': 39.99,
            'category': 'Accesorios',
            'stock': 30,
            'user_id': 1,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        },
        {
            'name': 'Hub USB-C Anker',
            'description': 'Hub multi-puerto para laptops modernas',
            'price': 69.99,
            'category': 'Accesorios',
            'stock': 20,
            'user_id': 1,
            'created_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'updated_at': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'version': 1
        }
    ]

    # Insertar los nuevos items
    for item in additional_items:
        op.execute(
            sa.text("""
                INSERT INTO items (name, description, price, category, stock, user_id, created_at, updated_at, version)
                VALUES (:name, :description, :price, :category, :stock, :user_id, :created_at, :updated_at, :version)
            """).bindparams(
                name=item['name'],
                description=item['description'],
                price=item['price'],
                category=item['category'],
                stock=item['stock'],
                user_id=item['user_id'],
                created_at=item['created_at'],
                updated_at=item['updated_at'],
                version=item['version']
            )
        )


def downgrade() -> None:
    """Downgrade schema: Eliminar los registros agregados"""

    # Lista de nombres de items a eliminar (para rollback)
    items_to_remove = [
        'iPad Pro 12.9"',
        'Samsung Galaxy Tab S9',
        'Mac Mini M2',
        'Nintendo Switch OLED',
        'Sony PlayStation Portal',
        'Canon EOS R5',
        'Nikon Zf',
        'Echo Dot (5ª Gen)',
        'Nest Thermostat',
        'Monitor LG 34WN650-W',
        'Teclado Logitech MX Keys',
        'Apple Watch Ultra 2',
        'Garmin Fenix 7',
        'Sony WH-1000XM5',
        'Bose QuietComfort Earbuds II',
        'Google Pixel 8 Pro',
        'OnePlus 12',
        'Base de carga MagSafe',
        'Hub USB-C Anker'
    ]

    # Eliminar los items por nombre
    for item_name in items_to_remove:
        op.execute(
            sa.text("DELETE FROM items WHERE name = :name").bindparams(name=item_name)
        )
