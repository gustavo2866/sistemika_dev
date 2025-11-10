# Script de Validación de GitHub Actions y GCP
# Verifica que toda la configuración esté correcta para deployments automáticos

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  VALIDACIÓN DE GITHUB ACTIONS + GCP CLOUD RUN" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$errors = @()
$warnings = @()
$success = @()

# ============================================================================
# 1. VERIFICAR ARCHIVO WORKFLOW
# ============================================================================
Write-Host "`n[1/8] Verificando archivo workflow..." -ForegroundColor Yellow

$workflowPath = "c:\Users\gpalmieri\source\sistemika\.github\workflows\deploy-gcp.yml"
if (Test-Path $workflowPath) {
    $success += "✓ Archivo workflow existe: $workflowPath"
    
    # Validar sintaxis YAML básica
    $content = Get-Content $workflowPath -Raw
    if ($content -match "on:\s+push:" -and $content -match "branches:" -and $content -match "master") {
        $success += "✓ Trigger configurado correctamente (push a master)"
    } else {
        $errors += "✗ Trigger no configurado correctamente"
    }
    
    # Verificar que apunte al directorio correcto
    if ($content -match "--source \./sak/backend") {
        $success += "✓ Source directory correcto (./sak/backend)"
    } else {
        $warnings += "⚠ Source directory podría no ser correcto"
    }
    
    # Verificar secrets requeridos
    if ($content -match '\$\{\{ secrets\.GCP_SA_KEY \}\}') {
        $success += "✓ Usa secret GCP_SA_KEY"
    } else {
        $errors += "✗ No usa secret GCP_SA_KEY"
    }
    
} else {
    $errors += "✗ Archivo workflow NO encontrado en: $workflowPath"
}

# ============================================================================
# 2. VERIFICAR AUTENTICACIÓN GCP
# ============================================================================
Write-Host "`n[2/8] Verificando autenticación GCP..." -ForegroundColor Yellow

try {
    $account = gcloud config get-value account 2>$null
    if ($account) {
        $success += "✓ Autenticado en GCP como: $account"
    } else {
        $errors += "✗ No autenticado en GCP"
    }
    
    $project = gcloud config get-value project 2>$null
    if ($project -eq "sak-wcl") {
        $success += "✓ Proyecto correcto: sak-wcl"
    } else {
        $errors += "✗ Proyecto incorrecto o no configurado (esperado: sak-wcl, actual: $project)"
    }
} catch {
    $errors += "✗ Error verificando autenticación GCP: $_"
}

# ============================================================================
# 3. VERIFICAR SERVICE ACCOUNT
# ============================================================================
Write-Host "`n[3/8] Verificando Service Account..." -ForegroundColor Yellow

try {
    $serviceAccounts = gcloud iam service-accounts list --project=sak-wcl --format="value(email)" 2>$null
    $targetSA = "sak-wcl-service@sak-wcl.iam.gserviceaccount.com"
    
    if ($serviceAccounts -match $targetSA) {
        $success += "✓ Service Account existe: $targetSA"
        
        # Verificar roles
        $roles = gcloud projects get-iam-policy sak-wcl --flatten="bindings[].members" --filter="bindings.members:$targetSA" --format="value(bindings.role)" 2>$null
        
        $requiredRoles = @(
            "roles/run.admin",
            "roles/iam.serviceAccountUser",
            "roles/artifactregistry.writer",
            "roles/cloudbuild.builds.builder"
        )
        
        foreach ($role in $requiredRoles) {
            if ($roles -match $role) {
                $success += "  ✓ Role asignado: $role"
            } else {
                $errors += "  ✗ Role faltante: $role"
            }
        }
    } else {
        $errors += "✗ Service Account NO encontrado: $targetSA"
    }
} catch {
    $errors += "✗ Error verificando Service Account: $_"
}

# ============================================================================
# 4. VERIFICAR SERVICIO CLOUD RUN
# ============================================================================
Write-Host "`n[4/8] Verificando servicio Cloud Run..." -ForegroundColor Yellow

try {
    $serviceInfo = gcloud run services describe sak-backend --region=us-central1 --project=sak-wcl --format="json" 2>$null | ConvertFrom-Json
    
    if ($serviceInfo) {
        $success += "✓ Servicio Cloud Run existe: sak-backend"
        
        # Verificar estado
        $readyCondition = $serviceInfo.status.conditions | Where-Object { $_.type -eq "Ready" }
        if ($readyCondition.status -eq "True") {
            $success += "  ✓ Estado: Ready"
        } else {
            $errors += "  ✗ Estado: NOT Ready"
        }
        
        # Verificar URL
        $url = $serviceInfo.status.url
        if ($url) {
            $success += "  ✓ URL: $url"
        }
        
        # Verificar Service Account
        $serviceSA = $serviceInfo.spec.template.spec.serviceAccountName
        if ($serviceSA -eq "sak-wcl-service@sak-wcl.iam.gserviceaccount.com") {
            $success += "  ✓ Service Account configurado correctamente"
        } else {
            $warnings += "  ⚠ Service Account diferente: $serviceSA"
        }
        
        # Verificar región
        $region = $serviceInfo.metadata.labels.region
        if ($region -eq "us-central1" -or $serviceInfo.metadata.name -match "us-central1") {
            $success += "  ✓ Región: us-central1"
        } else {
            $warnings += "  ⚠ Región podría no ser us-central1"
        }
        
    } else {
        $errors += "✗ Servicio Cloud Run NO encontrado: sak-backend"
    }
} catch {
    $errors += "✗ Error verificando Cloud Run: $_"
}

# ============================================================================
# 5. VERIFICAR VARIABLES DE ENTORNO
# ============================================================================
Write-Host "`n[5/8] Verificando variables de entorno..." -ForegroundColor Yellow

try {
    $envVars = gcloud run services describe sak-backend --region=us-central1 --project=sak-wcl --format="json" 2>$null | ConvertFrom-Json
    $containers = $envVars.spec.template.spec.containers[0].env
    
    $requiredEnvVars = @("ENV", "CORS_ORIGINS", "SQLALCHEMY_ECHO", "GCS_PROJECT_ID", "GCS_BUCKET_NAME", "GCS_INVOICE_FOLDER")
    
    foreach ($varName in $requiredEnvVars) {
        $found = $containers | Where-Object { $_.name -eq $varName }
        if ($found) {
            $success += "  ✓ Variable: $varName = $($found.value)"
        } else {
            $warnings += "  ⚠ Variable faltante: $varName"
        }
    }
    
    # Verificar secrets
    $requiredSecrets = @("DATABASE_URL", "OPENAI_API_KEY", "JWT_SECRET")
    foreach ($secretName in $requiredSecrets) {
        $found = $containers | Where-Object { $_.name -eq $secretName -and $_.valueFrom.secretKeyRef }
        if ($found) {
            $success += "  ✓ Secret referenciado: $secretName"
        } else {
            $errors += "  ✗ Secret NO referenciado: $secretName"
        }
    }
    
} catch {
    $errors += "✗ Error verificando variables de entorno: $_"
}

# ============================================================================
# 6. VERIFICAR CONECTIVIDAD AL SERVICIO
# ============================================================================
Write-Host "`n[6/8] Verificando conectividad al servicio..." -ForegroundColor Yellow

try {
    $url = "https://sak-backend-3urfgqrzea-uc.a.run.app/docs"
    $response = Invoke-WebRequest -Uri $url -Method HEAD -TimeoutSec 10 -UseBasicParsing 2>$null
    
    if ($response.StatusCode -eq 200) {
        $success += "✓ Servicio responde correctamente: $url"
    } else {
        $warnings += "⚠ Servicio responde con código: $($response.StatusCode)"
    }
} catch {
    $warnings += "⚠ No se pudo conectar al servicio (puede estar en cold start)"
}

# ============================================================================
# 7. VERIFICAR ÚLTIMO DEPLOYMENT
# ============================================================================
Write-Host "`n[7/8] Verificando último deployment..." -ForegroundColor Yellow

try {
    $revisions = gcloud run revisions list --service=sak-backend --region=us-central1 --project=sak-wcl --limit=1 --format="json" 2>$null | ConvertFrom-Json
    
    if ($revisions) {
        $lastRevision = $revisions[0]
        $deployTime = $lastRevision.metadata.creationTimestamp
        $success += "✓ Última revisión: $($lastRevision.metadata.name)"
        $success += "  ✓ Desplegado: $deployTime"
        
        # Verificar tráfico
        $serviceInfo = gcloud run services describe sak-backend --region=us-central1 --project=sak-wcl --format="json" 2>$null | ConvertFrom-Json
        $traffic = $serviceInfo.status.traffic | Where-Object { $_.revisionName -eq $lastRevision.metadata.name }
        if ($traffic.percent -eq 100) {
            $success += "  ✓ Recibiendo 100% del tráfico"
        } else {
            $warnings += "  ⚠ Recibiendo $($traffic.percent)% del tráfico"
        }
    }
} catch {
    $warnings += "⚠ No se pudo obtener información de revisiones"
}

# ============================================================================
# 8. VERIFICAR SECRETS (Si hay billing habilitado)
# ============================================================================
Write-Host "`n[8/8] Verificando secrets en Secret Manager..." -ForegroundColor Yellow

try {
    $secrets = gcloud secrets list --project=sak-wcl --format="value(name)" 2>$null
    
    if ($secrets) {
        $requiredSecrets = @("DATABASE_URL", "OPENAI_API_KEY", "JWT_SECRET")
        foreach ($secretName in $requiredSecrets) {
            if ($secrets -match $secretName) {
                $success += "  ✓ Secret existe: $secretName"
            } else {
                $errors += "  ✗ Secret faltante: $secretName"
            }
        }
    } else {
        $warnings += "⚠ No se pudo acceder a Secret Manager (billing podría no estar habilitado)"
    }
} catch {
    $warnings += "⚠ Error accediendo a Secret Manager: $_"
}

# ============================================================================
# RESUMEN
# ============================================================================
Write-Host "`n`n==================================================" -ForegroundColor Cyan
Write-Host "                    RESUMEN" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "`n✓ ÉXITOS: $($success.Count)" -ForegroundColor Green
foreach ($msg in $success) {
    Write-Host $msg -ForegroundColor Green
}

if ($warnings.Count -gt 0) {
    Write-Host "`n⚠ ADVERTENCIAS: $($warnings.Count)" -ForegroundColor Yellow
    foreach ($msg in $warnings) {
        Write-Host $msg -ForegroundColor Yellow
    }
}

if ($errors.Count -gt 0) {
    Write-Host "`n✗ ERRORES: $($errors.Count)" -ForegroundColor Red
    foreach ($msg in $errors) {
        Write-Host $msg -ForegroundColor Red
    }
    
    Write-Host "`n❌ VALIDACIÓN FALLIDA - Hay errores que deben corregirse" -ForegroundColor Red
    Write-Host "Consulta la documentación en: doc/deployment/github-actions.md" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "`n✅ VALIDACIÓN EXITOSA - GitHub Actions está correctamente configurado" -ForegroundColor Green
    
    if ($warnings.Count -gt 0) {
        Write-Host "⚠  Hay algunas advertencias que deberías revisar" -ForegroundColor Yellow
    }
    
    Write-Host "`nPuedes hacer deploy con seguridad ejecutando:" -ForegroundColor Cyan
    Write-Host "  git push origin master" -ForegroundColor White
    exit 0
}
