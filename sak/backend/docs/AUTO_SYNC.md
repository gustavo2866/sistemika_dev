# 🔄 Sincronización Automática de Branches

## ¿Qué hace el GitHub Action?

Cada vez que haces **push al branch `gcp`**, automáticamente:

1. ✅ Se ejecuta un workflow en GitHub
2. ✅ Hace checkout del repositorio
3. ✅ Mergea `gcp` a `master`
4. ✅ Pushea los cambios a `master`

**Resultado:** Ya no necesitas hacer el merge manualmente a `master`.

---

## 🚀 Flujo de Trabajo Simplificado

### **ANTES** (Manual):
```powershell
git add .
git commit -m "message"
git push origin gcp
git checkout master      # ❌ Manual
git merge gcp           # ❌ Manual
git push origin master  # ❌ Manual
git checkout gcp        # ❌ Manual
```

### **AHORA** (Automatizado):
```powershell
git add .
git commit -m "message"
git push origin gcp
# ✅ GitHub Actions hace el resto automáticamente
```

---

## 📋 Scripts Actualizados

### 1. **`deploy-gcp.ps1`** - Ya no necesita merge manual

El script ahora puede omitir el merge local porque GitHub Actions lo hace automáticamente:

```powershell
# Opción 1: Dejar que GitHub Actions haga el merge
.\deploy-gcp.ps1 -Message "Update" -SkipMerge

# Opción 2: Hacer merge local (por si quieres tenerlo inmediatamente)
.\deploy-gcp.ps1 -Message "Update"
```

### 2. **`quick-deploy.ps1`** - Versión actualizada

```powershell
# El script puede ser más simple ahora
.\quick-deploy.ps1 "message"
# Solo hace: add, commit, push a gcp
# GitHub Actions sincroniza master automáticamente
```

---

## ⚙️ Configuración del GitHub Action

**Archivo:** `.github/workflows/sync-master.yml`

### ¿Cuándo se ejecuta?
- Cada push al branch `gcp`

### ¿Qué hace?
1. Checkout del repo
2. Configura Git
3. Merge `gcp` → `master`
4. Push a `master`

### ¿Cuánto tarda?
- Aprox. 10-30 segundos

---

## 🔍 Verificar que funciona

### Después de hacer push a `gcp`:

1. Ve a GitHub: https://github.com/gustavo2866/sistemika_dev/actions
2. Verás un workflow ejecutándose: "Auto Sync Master from GCP"
3. Espera a que termine (ícono verde ✅)
4. Verifica que `master` tiene tus cambios

---

## 📝 Ventajas

| Antes | Ahora |
|-------|-------|
| 7 comandos manuales | 3 comandos |
| Posibilidad de olvidar merge | Automático |
| Cambiar de branch | No necesario |
| 2-3 minutos | 30 segundos |

---

## 🛠️ Scripts Recomendados (Actualizados)

### Script Simplificado: `quick-deploy-v2.ps1`

```powershell
# Solo commit y push - GitHub Actions hace el resto
git add .
git commit -m $Message
git push origin gcp
Write-Host "✅ Push completado. GitHub Actions sincronizará master automáticamente."
```

---

## ⚠️ Consideraciones

### ¿Y si hay conflictos?
- El workflow fallará y te notificará
- Tendrás que resolver conflictos manualmente

### ¿Puedo desactivarlo?
- Sí, elimina el archivo `.github/workflows/sync-master.yml`

### ¿Funciona con otros branches?
- Solo está configurado para `gcp` → `master`
- Puedes agregar más branches editando el workflow

---

## 🎯 Próximos Pasos

1. ✅ Commit del workflow al repositorio
2. ✅ Push para activarlo
3. ✅ Probar haciendo un cambio y push a `gcp`
4. ✅ Verificar en GitHub Actions que se ejecutó

---

## 🔗 Enlaces Útiles

- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **Tu repositorio Actions:** https://github.com/gustavo2866/sistemika_dev/actions
- **Logs de ejecución:** Ver en la pestaña Actions después de cada push

---

**Última actualización:** 11 de Octubre, 2025
