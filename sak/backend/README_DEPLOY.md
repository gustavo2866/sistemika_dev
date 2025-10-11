# 🚀 Guía de Deploy Automatizado

## Scripts Disponibles

### 1. **`deploy-gcp.ps1`** - Deploy Completo (Recomendado)

Script completo que automatiza todo el proceso de deploy.

**Uso básico:**
```powershell
.\deploy-gcp.ps1 -Message "Fix CORS configuration"
```

**Con opciones:**
```powershell
# Saltar tests
.\deploy-gcp.ps1 -Message "Update endpoints" -SkipTests

# Saltar merge a master
.\deploy-gcp.ps1 -Message "WIP changes" -SkipMerge

# Ambos
.\deploy-gcp.ps1 -Message "Testing" -SkipTests -SkipMerge
```

**¿Qué hace?**
1. ✅ Verifica que estés en branch `gcp`
2. ✅ Hace `git add .`
3. ✅ Hace `git commit` con tu mensaje
4. ✅ Hace `git push origin gcp`
5. ✅ Mergea a `master` (opcional)
6. ✅ Ejecuta tests (opcional)
7. ✅ Muestra el comando para Cloud Shell
8. ✅ Opción de copiar comando al portapapeles

---

### 2. **`quick-deploy.ps1`** - Deploy Rápido

Versión simplificada para deployar rápido.

**Uso:**
```powershell
.\quick-deploy.ps1 "mensaje del commit"

# O sin mensaje (usa "Update backend" por defecto)
.\quick-deploy.ps1
```

**¿Qué hace?**
1. ✅ Git add, commit, push
2. ✅ Merge a master
3. ✅ Muestra instrucciones para Cloud Shell

---

## 📋 Flujo de Trabajo Recomendado

### Opción A: Deploy Completo con Tests
```powershell
# 1. Hacer cambios en el código
# 2. Ejecutar script
.\deploy-gcp.ps1 -Message "Add new feature"

# 3. Copiar comando y ejecutar en Cloud Shell
```

### Opción B: Deploy Rápido sin Tests
```powershell
.\quick-deploy.ps1 "Fix bug"
```

### Opción C: Solo commit (sin merge a master)
```powershell
.\deploy-gcp.ps1 -Message "WIP: testing" -SkipMerge -SkipTests
```

---

## 🔧 Comando Manual de Deploy

Si prefieres hacer el deploy manualmente en Cloud Shell:

```bash
cd ~/sistemika_dev/sak
git pull origin gcp

gcloud run deploy sak-backend \
  --source ./backend \
  --region us-central1 \
  --project sak-wcl \
  --service-account sak-wcl-service@sak-wcl.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest" \
  --set-env-vars="ENV=prod,CORS_ORIGINS=https://wcl-seven.vercel.app;http://localhost:3000,SQLALCHEMY_ECHO=0"
```

---

## 🎯 Casos de Uso

| Escenario | Comando |
|-----------|---------|
| Deploy normal | `.\deploy-gcp.ps1 -Message "message"` |
| Deploy rápido | `.\quick-deploy.ps1 "message"` |
| Solo commit (sin merge) | `.\deploy-gcp.ps1 -Message "WIP" -SkipMerge` |
| Deploy sin tests | `.\deploy-gcp.ps1 -Message "message" -SkipTests` |

---

## ⚠️ Notas Importantes

1. **Siempre ejecuta desde:** `c:\Users\gpalmieri\source\sistemika\sak\backend`
2. **Branch requerido:** `gcp`
3. **Después del script:** Ejecutar comando en Cloud Shell para deploy
4. **Tests:** Por defecto se ejecutan, usa `-SkipTests` para saltarlos

---

## 🐛 Troubleshooting

### Error: "Debes estar en branch 'gcp'"
```powershell
git checkout gcp
```

### Error en push
```powershell
git pull origin gcp --rebase
.\deploy-gcp.ps1 -Message "your message"
```

### Deshacer último commit (sin push)
```powershell
git reset --soft HEAD~1
```

---

## 📝 Changelog de Scripts

- **v1.0** - Script inicial de deploy completo
- **v1.0** - Script quick-deploy para deploys rápidos
