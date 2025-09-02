// lib/upload.ts
export async function uploadUserPhoto(file: File): Promise<string> {
  try {
    console.log('Uploading file:', file.name, file.size);
    
    const endpoint = "http://localhost:8000/api/upload";
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(endpoint, { 
      method: "POST", 
      body: formData 
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || `Error HTTP ${res.status}: No se pudo subir la imagen`);
    }
    
    const data = await res.json() as { url: string; filename: string };
    
    // Construir URL completa
    const fullUrl = `http://localhost:8000${data.url}`;
    
    console.log('Upload successful:', data);
    return fullUrl;
    
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}
