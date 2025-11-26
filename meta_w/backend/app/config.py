"""
Configuración de la aplicación
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Configuración de la aplicación"""
    
    # Base de datos
    DATABASE_URL: str
    SQLALCHEMY_ECHO: bool = False
    
    # FastAPI
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = True
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"
    
    # Meta WhatsApp API
    META_API_VERSION: str = "v18.0"
    META_ACCESS_TOKEN: str = ""
    META_PHONE_NUMBER_ID: str = ""
    META_WEBHOOK_VERIFY_TOKEN: str = ""
    
    # ngrok
    NGROK_AUTH_TOKEN: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Convierte CORS_ORIGINS de string a lista"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
