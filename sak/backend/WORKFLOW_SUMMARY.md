# 🚀 Workflow de Desarrollo y Deploy - Resumen Ejecutivo

## 📋 Flujo Completo Implementado

```
┌────────────────────────────────────────────────────────────┐
│              🔧 FASE 1: DESARROLLO (gcp branch)            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. Hacer cambios en el código                            │
│  2. Probar localmente:                                     │
│     • Backend: http://localhost:8000                       │
│     • Frontend: http://localhost:3000                      │
│                                                            │
│  3. Commit y push a gcp:                                   │
│     git add .                                              │
│     git commit -m "feat: nueva funcionalidad"              │
│     git push origin gcp                                    │
│                                                            │
│  ⚡ GitHub Actions: sync-master.yml                        │
│     → Automáticamente mergea gcp → master                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│         🚀 FASE 2: PRODUCCIÓN (master branch)             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Cuando estés listo para producción:                      │
│                                                            │
│  4. Ejecutar script de deploy:                            │
│     cd backend                                             │
│     .\deploy-to-production.ps1                             │
│                                                            │
│     El script:                                             │
│     • ✅ Verifica tests                                    │
│     • ✅ Confirma el deploy                                │
│     • ✅ Mergea gcp → master localmente                    │
│     • ✅ Push a master                                     │
│                                                            │
│  ⚡ GitHub Actions: deploy-gcp-backend.yml                 │
│     → Despliega automáticamente a GCP Cloud Run            │
│     → URL: https://sak-backend-94464199991...run.app       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Configuración Inicial (Una Sola Vez)

### **PASO 1: Configurar Secreto GCP_SA_KEY en GitHub**

```powershell
cd c:\Users\gpalmieri\source\sistemika\sak\backend
.\setup-github-secret.ps1
```

Este script:
- ✅ Lee `gcp-credentials.json`
- ✅ Codifica en base64
- ✅ Copia al portapapeles
- ✅ Muestra instrucciones para agregarlo en GitHub

**Luego:**
1. Ve a: https://github.com/gustavo2866/sistemika_dev/settings/secrets/actions
2. Click en **"New repository secret"**
3. Name: `GCP_SA_KEY`
4. Value: **Ctrl+V** (pegar desde portapapeles)
5. Click **"Add secret"**

---

## 📝 Scripts Disponibles

### **1. quick-deploy.ps1** (Desarrollo Rápido)
```powershell
# Deploy rápido a gcp sin merge a master
.\quick-deploy.ps1 -Message "fix: corregir bug en facturas"
```

**Qué hace:**
- ✅ git add + commit + push a gcp
- ✅ GitHub Actions automáticamente sincroniza a master
- ❌ NO despliega a producción

---

### **2. deploy-to-production.ps1** (Producción)
```powershell
# Deploy completo a producción con confirmación
.\deploy-to-production.ps1 -Message "Release v1.2.0"

# Opciones disponibles:
.\deploy-to-production.ps1 -SkipTests  # Sin ejecutar tests
```

**Qué hace:**
- ✅ Verifica que estás en branch gcp
- ✅ Ejecuta tests (opcional)
- ⚠️  Pide confirmación para producción
- ✅ Mergea gcp → master
- ✅ Push a master
- ⚡ **GitHub Actions despliega a GCP automáticamente**
- ✅ Vuelve a branch gcp

---

### **3. deploy-gcp.ps1** (Avanzado)
```powershell
# Control completo del proceso
.\deploy-gcp.ps1 -Message "Update" -SkipTests -SkipMerge
```

**Opciones:**
- `-SkipTests`: No ejecutar tests
- `-SkipMerge`: No hacer merge a master

---

## 🔍 Monitoreo del Deploy

### **Ver el progreso en GitHub Actions:**
```
https://github.com/gustavo2866/sistemika_dev/actions
```

### **Verificar el deploy:**
```powershell
# Health check
curl https://sak-backend-94464199991.us-central1.run.app/health

# Usuarios
curl https://sak-backend-94464199991.us-central1.run.app/users
```

---

## 📊 Ejemplo de Flujo Completo

### **Día 1-5: Desarrollo**
```powershell
# 1. Desarrollar feature nueva
git checkout gcp
# ... hacer cambios en código ...

# 2. Probar localmente
cd backend
uvicorn app.main:app --reload  # Terminal 1

cd frontend
npm run dev                    # Terminal 2

# 3. Commit y push
git add .
git commit -m "feat: agregar reporte de facturas"
git push origin gcp

# ⚡ GitHub Actions automáticamente sincroniza a master
```

### **Día 6: Deploy a Producción**
```powershell
# 1. Cuando estés listo para producción
cd backend
.\deploy-to-production.ps1 -Message "Release: Reportes v1.0"

# 2. El script pregunta confirmación:
#    "¿Continuar con el deploy a producción? (s/n)"
#    Responder: s

# 3. Monitor en GitHub Actions:
#    https://github.com/gustavo2866/sistemika_dev/actions

# 4. Verificar en ~2-3 minutos:
curl https://sak-backend-94464199991.us-central1.run.app/health
```

---

## 🛠️ Troubleshooting

### **Error: "secret GCP_SA_KEY not found"**
```powershell
# Solución: Configurar el secreto
cd backend
.\setup-github-secret.ps1
```

### **Error: "permission denied" en GitHub Actions**
```
# Solución: Verificar permisos del Service Account en GCP
# https://console.cloud.google.com/iam-admin/serviceaccounts?project=sak-wcl
```

### **Error: "tests failed"**
```powershell
# Opción 1: Corregir los tests y volver a deployar

# Opción 2: Skip tests temporalmente
.\deploy-to-production.ps1 -SkipTests
```

### **Ver logs de Cloud Run:**
```
https://console.cloud.google.com/run/detail/us-central1/sak-backend/logs?project=sak-wcl
```

---

## 📚 Documentación Adicional

- **`backend/docs/GITHUB_SECRETS.md`**: Configuración detallada de secretos
- **`backend/docs/AUTO_SYNC.md`**: Explicación del workflow completo
- **`backend/README_DEPLOY.md`**: Guía de deployment scripts
- **`.github/workflows/sync-master.yml`**: Workflow de auto-sync
- **`.github/workflows/deploy-gcp-backend.yml`**: Workflow de deploy a GCP

---

## ✅ Checklist de Configuración

- [ ] **GCP_SA_KEY** configurado en GitHub Secrets
- [ ] **Backend** desplegado en Cloud Run
- [ ] **Frontend** configurado con backend URL de GCP
- [ ] **Tests** ejecutándose correctamente
- [ ] **GitHub Actions** workflows activos

---

## 🎯 URLs Importantes

| Recurso | URL |
|---------|-----|
| **Backend Producción** | https://sak-backend-94464199991.us-central1.run.app |
| **Frontend Producción** | https://wcl-seven.vercel.app |
| **GitHub Actions** | https://github.com/gustavo2866/sistemika_dev/actions |
| **GCP Console** | https://console.cloud.google.com/run?project=sak-wcl |
| **Neon Database** | https://console.neon.tech/app/projects |

---

## 🚨 Recordatorios de Seguridad

- ❌ **NUNCA** commitear `gcp-credentials.json`
- ❌ **NUNCA** commitear archivos `.env`
- ❌ **NUNCA** compartir `GCP_SA_KEY` públicamente
- ✅ Los secretos están en `.gitignore`
- ✅ Usar GitHub Secrets para credenciales
- ✅ Usar GCP Secret Manager para producción

---

## 🎉 ¡Listo para Producción!

Ahora tienes un workflow completamente automatizado:

1. **Desarrolla** en `gcp` branch
2. **Prueba** localmente
3. **Push** a `gcp` (auto-sync a master)
4. **Deploy** a producción con un comando
5. **Monitorea** en GitHub Actions
6. **Verifica** en GCP Cloud Run

**¡Happy Coding! 🚀**
