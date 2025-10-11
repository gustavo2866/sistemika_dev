# 🎯 Configuración de Vercel para Auto-Deploy desde Master

## 📝 Pasos para Configurar

### **1. Ir al Dashboard de Vercel**
```
https://vercel.com/dashboard
```

### **2. Seleccionar el Proyecto**
- Busca tu proyecto (probablemente se llama `wcl` o `sistemika`)
- Click en el proyecto

### **3. Configurar Git (Production Branch)**

**Ir a:** Settings → Git

**Configurar:**
```
Production Branch: master
```

**Opciones recomendadas:**
- ✅ **Automatic Deployments:** Enabled
- ✅ **Deploy on Push:** Enabled
- ✅ **Vercel for GitHub:** Connected

### **4. Configurar Variables de Entorno**

**Ir a:** Settings → Environment Variables

**Agregar:**
```
Variable Name:  NEXT_PUBLIC_API_URL
Value:          https://sak-backend-94464199991.us-central1.run.app
Environments:   ✅ Production
                ✅ Preview
                ✅ Development
```

### **5. Verificar Deploy Hooks (Opcional)**

**Ir a:** Settings → Git → Deploy Hooks

Esto es opcional, pero puedes crear un hook para triggers manuales si lo necesitas.

### **6. Redeploy Manual (Primera Vez)**

**Ir a:** Deployments → Latest Deployment → Redeploy

Esto asegura que la nueva configuración se aplique.

---

## ✅ Verificación

### **1. Verificar Branch en Vercel**
```
Settings → Git → Production Branch: master ✅
```

### **2. Verificar Variables de Entorno**
```
Settings → Environment Variables
NEXT_PUBLIC_API_URL = https://sak-backend... ✅
```

### **3. Verificar Auto-Deploy**
```
Settings → Git → Automatic Deployments: Enabled ✅
```

---

## 🧪 Prueba de Flujo Completo

### **Paso 1: Hacer un Cambio Pequeño**
```powershell
cd c:\Users\gpalmieri\source\sistemika\sak\frontend

# Editar algo simple (ejemplo: cambiar un texto)
# src/pages/index.tsx o cualquier archivo

git add .
git commit -m "test: verificar auto-deploy de Vercel"
git push origin gcp
```

### **Paso 2: Esperar Auto-Sync**
```
GitHub Actions ejecutará sync-master.yml automáticamente
✅ Verifica en: https://github.com/gustavo2866/sistemika_dev/actions
```

### **Paso 3: Ejecutar Deploy a Producción**
```powershell
cd c:\Users\gpalmieri\source\sistemika\sak\backend
.\deploy-to-production.ps1 -Message "test: verificar deploy completo"
```

### **Paso 4: Monitorear Deploys**

**GitHub Actions (Backend):**
```
https://github.com/gustavo2866/sistemika_dev/actions
Buscar: "Deploy Backend to GCP Cloud Run"
```

**Vercel (Frontend):**
```
https://vercel.com/dashboard
→ Tu proyecto → Deployments
Deberías ver un nuevo deployment "in progress"
```

### **Paso 5: Verificar URLs**

**Backend:**
```powershell
curl https://sak-backend-94464199991.us-central1.run.app/health
```

**Frontend:**
```
Abrir: https://wcl-seven.vercel.app
Verificar que el cambio se ve reflejado
```

---

## 🔧 Troubleshooting

### **Error: Vercel no despliega automáticamente**

**Solución 1: Verificar conexión GitHub-Vercel**
```
1. Ve a: https://vercel.com/dashboard
2. Settings → Git
3. Verifica que "Vercel for GitHub" está conectado
4. Si no, click en "Connect Git Repository"
```

**Solución 2: Verificar permisos de GitHub**
```
1. Ve a: https://github.com/settings/installations
2. Busca "Vercel"
3. Verifica que tiene acceso al repositorio "sistemika_dev"
```

**Solución 3: Trigger manual**
```
1. Ve a Vercel Dashboard → Deployments
2. Click en "..." → Redeploy
3. Selecciona branch "master"
```

### **Error: Variables de entorno no se aplican**

**Solución:**
```
1. Settings → Environment Variables
2. Editar NEXT_PUBLIC_API_URL
3. Asegurar que está marcado "Production"
4. Guardar cambios
5. Redeploy manual: Deployments → Redeploy
```

### **Error: Deploy se queda "Building..."**

**Solución:**
```
1. Click en el deployment "in progress"
2. Ver logs en "Build Logs"
3. Verificar errores de build
4. Common issues:
   - Errores de TypeScript
   - Dependencias faltantes
   - Variables de entorno incorrectas
```

---

## 📊 Configuración Final Esperada

### **Vercel Settings Summary:**
```yaml
Git Configuration:
  Production Branch: master
  Automatic Deployments: Enabled
  Deploy on Push: Enabled
  
Environment Variables:
  NEXT_PUBLIC_API_URL:
    Production: https://sak-backend-94464199991.us-central1.run.app
    Preview: https://sak-backend-94464199991.us-central1.run.app
    Development: https://sak-backend-94464199991.us-central1.run.app

Deployment Settings:
  Framework: Next.js
  Build Command: npm run build
  Output Directory: .next
  Install Command: npm install
```

---

## 🎯 Resultado Final

Después de esta configuración:

```powershell
# Desarrollar en gcp
git push origin gcp

# Cuando estés listo
cd backend
.\deploy-to-production.ps1

# ✅ Backend → GCP Cloud Run (automático)
# ✅ Frontend → Vercel (automático)
# ✅ Todo sincronizado en ~2-3 minutos
```

---

## 📞 Comandos Útiles

### **Ver estado de Vercel (con CLI instalado):**
```powershell
cd frontend
vercel ls
vercel env ls
```

### **Deploy manual desde CLI (si es necesario):**
```powershell
cd frontend
vercel --prod
```

### **Ver logs de producción:**
```powershell
vercel logs https://wcl-seven.vercel.app
```

---

## 🔒 Seguridad

**Variables de entorno sensibles:**
- ✅ Configurar en Vercel Dashboard (no en código)
- ✅ Marcar como "Sensitive" si están disponibles
- ❌ NUNCA commitear en archivos .env

**Access Control:**
- Verificar que solo usuarios autorizados tienen acceso al proyecto en Vercel
- Configurar "Team Settings" si trabajas en equipo
