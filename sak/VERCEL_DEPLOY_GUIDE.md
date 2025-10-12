# 🚀 Guía de Deploy en Vercel - Paso a Paso

## 📋 Checklist Pre-Deploy

- [x] ✅ Frontend compila correctamente (`npm run build` exitoso)
- [x] ✅ 0 vulnerabilidades de seguridad
- [x] ✅ Variables de entorno configuradas localmente
- [x] ✅ Scripts de switch backend creados
- [ ] ⏳ Configurar Vercel Dashboard
- [ ] ⏳ Deploy a producción

---

## 🎯 PASO 1: Acceder a Vercel

### **1.1 Ir al Dashboard de Vercel**
```
🔗 https://vercel.com/dashboard
```

### **1.2 Iniciar Sesión**
- Si no tienes cuenta, créala con tu cuenta de GitHub
- Si ya tienes cuenta, inicia sesión

---

## 🎯 PASO 2: Conectar Repositorio

### **2.1 Importar Proyecto**

1. **Click en "Add New..."** (botón en la esquina superior derecha)
2. **Selecciona "Project"**
3. **Importar Git Repository:**
   - Busca: `gustavo2866/sistemika_dev`
   - Click en **"Import"**

### **2.2 Configurar Proyecto**

**Root Directory:**
```
sak/frontend
```
⚠️ **IMPORTANTE:** Debes especificar el subdirectorio del frontend

**Framework Preset:**
```
Next.js (debería detectarlo automáticamente)
```

**Build Command:**
```
npm run build
```

**Output Directory:**
```
.next (default)
```

**Install Command:**
```
npm install
```

---

## 🎯 PASO 3: Configurar Git Branch

### **3.1 Production Branch**

En la configuración del proyecto:

1. Ve a: **Settings → Git**
2. **Production Branch:** 
   ```
   master
   ```
3. Guarda cambios

**¿Por qué master?**
- ✅ gcp = desarrollo
- ✅ master = producción
- ✅ Deploy automático cuando haces push a master

---

## 🎯 PASO 4: Configurar Variables de Entorno

### **4.1 Ir a Environment Variables**

1. Ve a: **Settings → Environment Variables**
2. Click en **"Add Variable"**

### **4.2 Agregar NEXT_PUBLIC_API_URL**

**Variable 1:**
```
Key:   NEXT_PUBLIC_API_URL
Value: https://sak-backend-94464199991.us-central1.run.app
```

**Environments (seleccionar los 3):**
- ✅ Production
- ✅ Preview
- ✅ Development

**Type:**
```
Plain Text
```

3. Click en **"Save"**

---

## 🎯 PASO 5: Deploy Inicial

### **5.1 Trigger First Deploy**

**Opción A: Deploy Automático**
- Vercel debería hacer el primer deploy automáticamente
- Monitorea en la pestaña **"Deployments"**

**Opción B: Deploy Manual**
1. Ve a: **Deployments**
2. Click en **"Redeploy"** del último deployment
3. Selecciona branch: **master**

### **5.2 Monitorear Build**

Verás algo como:
```
🔄 Building...
   ├─ Installing dependencies
   ├─ Running build command
   ├─ Optimizing
   └─ Finalizing

✅ Deployment Ready
   🌐 https://tu-proyecto.vercel.app
```

---

## 🎯 PASO 6: Verificar Deployment

### **6.1 Obtener URL de Producción**

Vercel te dará una URL como:
```
https://wcl-seven.vercel.app
O
https://tu-proyecto.vercel.app
```

### **6.2 Verificar que Funciona**

1. **Abre la URL en el navegador**
2. **Abre DevTools (F12) → Console**
3. **Verifica la variable de entorno:**
   ```javascript
   console.log(process.env.NEXT_PUBLIC_API_URL)
   // Debería mostrar: https://sak-backend-94464199991.us-central1.run.app
   ```

4. **Prueba alguna funcionalidad:**
   - Login
   - Carga de datos
   - Navegación

---

## 🎯 PASO 7: Configurar Domain (Opcional)

### **7.1 Si tienes un dominio propio**

1. Ve a: **Settings → Domains**
2. Click en **"Add Domain"**
3. Sigue las instrucciones para configurar DNS

### **7.2 Usar Dominio de Vercel**

Por defecto usarás:
```
https://nombre-proyecto.vercel.app
```

---

## ✅ Verificación Final

### **Checklist de Configuración:**

- [ ] Proyecto importado desde GitHub
- [ ] Root directory: `sak/frontend`
- [ ] Production branch: `master`
- [ ] Variable `NEXT_PUBLIC_API_URL` configurada
- [ ] Primer deploy exitoso
- [ ] URL de producción funcionando
- [ ] Backend conectado correctamente

---

## 🔄 Flujo de Deploy Automático

### **Ahora cuando hagas:**

```powershell
# 1. Desarrollar en gcp
cd frontend
# ... hacer cambios ...
git add .
git commit -m "feat: nueva funcionalidad"
git push origin gcp

# 2. Deploy a producción
cd ../backend
.\deploy-to-production.ps1

# ✨ Automáticamente:
# - GitHub Actions deploya backend a GCP
# - Vercel deploya frontend desde master
```

---

## 🛠️ Troubleshooting

### **Error: Build Failed**

**Ver logs:**
1. Deployments → Click en el deployment fallido
2. Ver "Build Logs"

**Causas comunes:**
- Variables de entorno faltantes
- Errores de TypeScript
- Dependencias faltantes

**Solución:**
```powershell
# Verificar build local
cd frontend
npm run build

# Si falla localmente, arreglar primero
# Si funciona localmente, revisar configuración de Vercel
```

### **Error: Variable de Entorno No Se Lee**

**Verificar:**
1. Settings → Environment Variables
2. Que tenga el prefijo `NEXT_PUBLIC_`
3. Que esté en "Production"

**Re-deploy después de cambiar variables:**
1. Deployments → Latest
2. Click "..." → Redeploy

### **Error: Cannot Connect to Backend**

**Verificar backend:**
```powershell
curl https://sak-backend-94464199991.us-central1.run.app/health
```

**Verificar CORS:**
- Backend debe tener la URL de Vercel en CORS_ORIGINS

---

## 📞 Siguiente Paso

Después de configurar Vercel, necesitas:

### **Configurar GitHub Secret para Backend**
```powershell
cd c:\Users\gpalmieri\source\sistemika\sak\backend
.\setup-github-secret.ps1
```

Esto permitirá que GitHub Actions despliegue el backend automáticamente.

---

## 🎉 ¡Listo!

Una vez completado, tendrás:
- ✅ Frontend en Vercel (auto-deploy desde master)
- ✅ Backend en GCP Cloud Run (auto-deploy desde master)
- ✅ Un solo comando para deployar todo: `.\deploy-to-production.ps1`

---

## 📚 URLs Importantes

| Recurso | URL |
|---------|-----|
| **Vercel Dashboard** | https://vercel.com/dashboard |
| **Frontend Producción** | https://wcl-seven.vercel.app |
| **Backend Producción** | https://sak-backend-94464199991.us-central1.run.app |
| **GitHub Actions** | https://github.com/gustavo2866/sistemika_dev/actions |
