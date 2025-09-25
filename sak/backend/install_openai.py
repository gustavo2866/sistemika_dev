import subprocess
import sys

def install_openai():
    """Instalar OpenAI si no está disponible"""
    try:
        import openai
        print(f"✅ OpenAI ya está instalado: {openai.__version__}")
        return True
    except ImportError:
        print("❌ OpenAI no está instalado")
        
        try:
            print("🔄 Instalando OpenAI...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "openai"])
            print("✅ OpenAI instalado correctamente")
            
            # Verificar instalación
            import openai
            print(f"✅ Verificación exitosa: {openai.__version__}")
            return True
        except Exception as e:
            print(f"❌ Error instalando OpenAI: {e}")
            return False

if __name__ == "__main__":
    install_openai()
