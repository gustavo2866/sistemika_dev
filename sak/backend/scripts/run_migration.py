"""Script para aplicar migraciones suprimiendo warnings de ciclos FK."""
import os
import sys
import logging
import warnings

warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alembic.config import Config
from alembic import command

c = Config("alembic.ini")

print("=== current ===")
command.current(c)

print("=== heads ===")
command.heads(c)

print("=== upgrade head ===")
command.upgrade(c, "head")

print("=== current post-upgrade ===")
command.current(c)

print("DONE")
