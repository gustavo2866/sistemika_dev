# 🔄 Cambiar entre Backend Local y GCP

## 🎯 Uso Rápido

### **Opción 1: Usar Scripts (Recomendado)**

```powershell
# Cambiar a backend local
.\switch-to-local.ps1

# Cambiar a backend GCP
.\switch-to-gcp.ps1
```

**Después de ejecutar cualquier script:**
1. Reinicia el servidor frontend (Ctrl+C → `npm run dev`)
2. Listo para trabajar

---

### **Opción 2: Editar Manualmente**

Abre `frontend/.env.local` y comenta/descomenta según necesites:

**Para backend local:**
```env
# Backend Local (Desarrollo)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend GCP (comentado)
# NEXT_PUBLIC_API_URL=https://sak-backend-94464199991.us-central1.run.app
```

**Para backend GCP:**
```env
# Backend GCP (Producción)
NEXT_PUBLIC_API_URL=https://sak-backend-94464199991.us-central1.run.app

# Backend Local (comentado)
# NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 📁 Archivos de Variables de Entorno

```
frontend/
├── .env.local       ← Desarrollo (TÚ LO CONTROLAS)
├── .env.production  ← Documentación (Vercel usa Dashboard)
├── .env.example     ← Template para otros devs
├── switch-to-local.ps1   ← Script para cambiar a local
└── switch-to-gcp.ps1     ← Script para cambiar a GCP
```

### **`.env.local`**
- ✅ Este es el archivo que tú modificas
- ✅ Git lo ignora (está en `.gitignore`)
- ✅ Solo afecta tu desarrollo local
- ✅ Usa los scripts para cambiarlo rápido

### **`.env.production`**
- ℹ️  Solo documentación
- ℹ️  No afecta el build de Vercel
- ℹ️  Las variables reales se configuran en Vercel Dashboard

### **`.env.example`**
- ℹ️  Template para otros desarrolladores
- ℹ️  Se commitea al repositorio
- ℹ️  Muestra qué variables se necesitan

---

## 🚀 Flujos de Trabajo Comunes

### **Escenario 1: Desarrollo Full Stack Local**

```powershell
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend
.\switch-to-local.ps1
npm run dev

# 🎉 Trabajas con todo local
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

---

### **Escenario 2: Desarrollo Frontend contra Backend en GCP**

```powershell
# Solo correr frontend
cd frontend
.\switch-to-gcp.ps1
npm run dev

# 🎉 Frontend local apunta a backend en producción
# Backend: https://sak-backend-94464199991.us-central1.run.app
# Frontend: http://localhost:3000
```

---

### **Escenario 3: Probar Cambios del Backend sin Deployar**

```powershell
# 1. Hacer cambios en backend
cd backend
# ... editar código ...

# 2. Correr backend local
uvicorn app.main:app --reload

# 3. Cambiar frontend a local
cd ../frontend
.\switch-to-local.ps1
npm run dev

# 4. Probar cambios
# Si todo funciona, deployar:
cd ../backend
.\deploy-to-production.ps1
```

---

## ⚙️ Configuración en Vercel

Para que producción funcione, configura en Vercel Dashboard:

1. **Ve a:** https://vercel.com/dashboard
2. **Proyecto → Settings → Environment Variables**
3. **Agregar:**
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://sak-backend-94464199991.us-central1.run.app`
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development

---

## 🔍 Verificar Configuración Actual

### **¿Qué backend estoy usando?**

```powershell
# Ver contenido de .env.local
cd frontend
Get-Content .env.local
```

### **¿Está funcionando?**

```powershell
# Verificar en el navegador
# Abre DevTools (F12) → Console
# Ejecuta:
console.log(process.env.NEXT_PUBLIC_API_URL)
```

O simplemente observa en la terminal del frontend cuando inicia:

```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- Environment:  development
- API URL:      http://localhost:8000  ← Aquí lo ves
```

---

## 🛠️ Troubleshooting

### **Los cambios no se aplican**

**Solución:** Reinicia el servidor frontend
```powershell
# Presiona Ctrl+C en la terminal
npm run dev
```

### **Error: Cannot connect to backend**

**Backend Local:**
```powershell
# Verifica que el backend esté corriendo
curl http://localhost:8000/health
```

**Backend GCP:**
```powershell
# Verifica que GCP esté respondiendo
curl https://sak-backend-94464199991.us-central1.run.app/health
```

### **Variable de entorno undefined**

**Causa:** `.env.local` no existe o está mal configurado

**Solución:**
```powershell
# Crea desde el template
cd frontend
Copy-Item .env.example .env.local
# Luego ejecuta el script que necesites
.\switch-to-gcp.ps1
```

---

## ✅ Checklist

- [ ] `.env.local` existe y tiene la URL correcta
- [ ] Scripts `switch-to-*.ps1` funcionan
- [ ] Backend (local o GCP) está respondiendo
- [ ] Frontend reiniciado después de cambiar variables
- [ ] DevTools muestra la URL correcta en console.log

---

## 📚 Referencias

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
