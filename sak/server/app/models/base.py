from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class Base(SQLModel):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
    version: int = Field(default=1, nullable=False)

STAMP_FIELDS = {"id", "created_at", "updated_at", "deleted_at", "version"}

def campos_editables(model_cls: type[SQLModel]) -> set[str]:
    return set(model_cls.model_fields.keys()) - STAMP_FIELDS 


