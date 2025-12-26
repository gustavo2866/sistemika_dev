"""
Script para asignar URLs de fotos de perfil a los usuarios.
Usa el servicio DiceBear Avatars para generar avatares con caras aleatorias.
"""
from sqlmodel import Session, select
from app.db import engine
from app.models.user import User
import hashlib


def generar_url_avatar(nombre: str, user_id: int) -> str:
    """
    Genera una URL de avatar usando DiceBear Avatars.
    Usa el estilo 'avataaars' que genera caras estilo ilustración.
    
    Args:
        nombre: Nombre completo del usuario
        user_id: ID del usuario para generar seed único
    
    Returns:
        URL del avatar generado
    """
    # Generar un seed único basado en el nombre y el ID
    seed_text = f"{nombre}-{user_id}"
    seed = hashlib.md5(seed_text.encode()).hexdigest()
    
    # Estilos disponibles con caras:
    # - avataaars: Estilo ilustración moderna (similar a Avataaars de Sketch)
    # - adventurer: Aventureros con diferentes accesorios
    # - big-ears: Caras con orejas grandes y expresivas
    # - fun-emoji: Emojis divertidos con caras
    # - personas: Caras más realistas y profesionales
    
    estilo = "avataaars"  # Cambiar a 'personas', 'adventurer', 'big-ears', etc.
    
    # DiceBear API v7
    url = f"https://api.dicebear.com/7.x/{estilo}/svg?seed={seed}&size=200"
    
    return url


def main():
    with Session(engine) as session:
        # Obtener todos los usuarios
        statement = select(User)
        usuarios = session.exec(statement).all()
        
        print(f"📋 Encontrados {len(usuarios)} usuarios")
        
        if not usuarios:
            print("✅ No hay usuarios en la base de datos")
            return
        
        # Actualizar cada usuario
        updated = 0
        for usuario in usuarios:
            url_avatar = generar_url_avatar(usuario.nombre, usuario.id)
            usuario.url_foto = url_avatar
            updated += 1
            
            if updated <= 10:  # Mostrar los primeros 10 ejemplos
                print(f"   {updated}. {usuario.nombre} → {url_avatar}")
        
        # Confirmar cambios
        print(f"\n📊 Resumen:")
        print(f"   - Total usuarios: {len(usuarios)}")
        print(f"   - URLs generadas: {updated}")
        
        confirmar = input("\n¿Confirmar cambios? (s/n): ").lower()
        if confirmar == 's':
            session.commit()
            print("\n✅ URLs de fotos asignadas exitosamente")
            
            # Mostrar algunos ejemplos
            print("\nEjemplos de URLs generadas:")
            for i, usuario in enumerate(usuarios[:5], 1):
                print(f"  {i}. {usuario.nombre}: {usuario.url_foto}")
        else:
            session.rollback()
            print("\n❌ Cambios cancelados")


if __name__ == "__main__":
    main()
