# check_deploy.ps1 - Verificaciones pre-deploy
# Uso: .\check_deploy.ps1

$Root     = $PSScriptRoot
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Failed   = 0

function Write-Section([string]$title) {
    Write-Host ""
    Write-Host "--- $title ---" -ForegroundColor Cyan
}

function Write-OK([string]$msg)   { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Fail([string]$msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:Failed++ }

# ── 1. Backend: imports ───────────────────────────────────────────────────────
Write-Section "Backend - imports"

$pyScript = @'
from app.main import app
routes = [r for r in app.routes if hasattr(r, 'path')]
print(len(routes))
'@

Push-Location $Backend
$out = $pyScript | python 2>&1
$pyExit = $LASTEXITCODE
Pop-Location

if ($pyExit -eq 0) {
    $count = ($out | Select-String '^\d+').Matches[0].Value
    Write-OK "app.main carga sin errores ($count rutas registradas)"
} else {
    Write-Fail "Error importando backend"
    $out | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
}

# ── 2. Backend: migraciones ───────────────────────────────────────────────────
Write-Section "Backend - migraciones"

Push-Location $Backend
$migOut  = python -m alembic -c alembic.ini current 2>&1
$headOut = python -m alembic -c alembic.ini heads  2>&1
Pop-Location

$currentMatch = $migOut  | Select-String '[0-9a-f]{12}'
$headMatch    = $headOut | Select-String '[0-9a-f]{12}'

if ($currentMatch -and $headMatch) {
    $currentRev = $currentMatch.Matches[0].Value
    $headRev    = $headMatch.Matches[0].Value
    if ($currentRev -eq $headRev) {
        Write-OK "Migraciones al dia (head: $headRev)"
    } else {
        Write-Fail "Migraciones desactualizadas - current: $currentRev  head: $headRev"
        Write-Host "    Ejecuta: alembic upgrade head" -ForegroundColor Yellow
    }
} else {
    Write-Fail "No se pudo leer el estado de Alembic"
    $migOut | Select-Object -First 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
}

# ── 3. Frontend: TypeScript ───────────────────────────────────────────────────
Write-Section "Frontend - TypeScript"

Push-Location $Frontend
$tsOut = npx tsc --noEmit 2>&1
$tsErrors = @($tsOut | Where-Object { $_ -match "error TS" })
Pop-Location

if ($tsErrors.Count -eq 0) {
    Write-OK "Sin errores de TypeScript"
} else {
    Write-Fail "$($tsErrors.Count) error(es) de TypeScript"
    $tsErrors | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
}

# ── 4. Frontend: ESLint ───────────────────────────────────────────────────────
Write-Section "Frontend - ESLint"

Push-Location $Frontend
$lintOut  = npx eslint src --ext .ts,.tsx 2>&1
$lintExit = $LASTEXITCODE
Pop-Location

$lintErrorLines   = @($lintOut | Where-Object { $_ -match "\s+error\s+" })
$lintWarningLines = @($lintOut | Where-Object { $_ -match "\s+warning\s+" })

if ($lintErrorLines.Count -eq 0) {
    if ($lintWarningLines.Count -gt 0) {
        Write-OK "ESLint sin errores ($($lintWarningLines.Count) warnings ignorables)"
    } else {
        Write-OK "ESLint sin problemas"
    }
} else {
    Write-Fail "ESLint: $($lintErrorLines.Count) error(es) reales"
    $lintErrorLines | Select-Object -First 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    if ($lintWarningLines.Count -gt 0) {
        Write-Host "    (+ $($lintWarningLines.Count) warnings)" -ForegroundColor DarkYellow
    }
}

# ── Resumen ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "--------------------------------------" -ForegroundColor Cyan
if ($Failed -eq 0) {
    Write-Host "  LISTO PARA DEPLOY [OK]" -ForegroundColor Green
} else {
    Write-Host "  $Failed CHECK(S) FALLARON - revisar antes de deployar" -ForegroundColor Red
}
Write-Host "--------------------------------------" -ForegroundColor Cyan
Write-Host ""

exit $Failed
