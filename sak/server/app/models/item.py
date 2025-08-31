from typing import Optional
from sqlmodel import SQLModel, Field
from .base import Base

class Item(Base, table=True):
    name: str
    description: Optional[str] = None


