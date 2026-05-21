#!/usr/bin/env pwsh
# Script para preparar el Service Account JSON para Vercel

$serviceAccountFile = "santiguia-service-account.json"

Write-Host "Preparando Service Account para Vercel..." -ForegroundColor Cyan
Write-Host ""

# Verificar que el archivo existe
if (-not (Test-Path $serviceAccountFile)) {
    Write-Host "ERROR: No se encontro el archivo '$serviceAccountFile'" -ForegroundColor Red
    Write-Host "   Asegurate de estar en la raiz del proyecto" -ForegroundColor Yellow
    exit 1
}

Write-Host "Archivo encontrado: $serviceAccountFile" -ForegroundColor Green

# Leer y minificar el JSON
try {
    Write-Host ""
    Write-Host "Minificando JSON..." -ForegroundColor Cyan
    
    $json = Get-Content $serviceAccountFile -Raw | ConvertFrom-Json
    $minified = $json | ConvertTo-Json -Compress -Depth 10
    
    # Copiar al portapapeles
    $minified | Set-Clipboard
    
    Write-Host "JSON minificado y copiado al portapapeles" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pasos siguientes:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Ve a Vercel Dashboard:" -ForegroundColor White
    Write-Host "   https://vercel.com/dashboard" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Selecciona tu proyecto santiagoguia" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Ve a: Settings > Environment Variables" -ForegroundColor White
    Write-Host ""
    Write-Host "4. Agrega una nueva variable:" -ForegroundColor White
    Write-Host "   Name: GOOGLE_SERVICE_ACCOUNT_JSON" -ForegroundColor Cyan
    Write-Host "   Value: [Pega desde el portapapeles con Ctrl+V]" -ForegroundColor Cyan
    Write-Host "   Environments: Production + Preview + Development" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "5. Click en Save y luego haz Redeploy" -ForegroundColor White
    Write-Host ""
    Write-Host "======================================================" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Vista previa del JSON (primeros 200 caracteres):" -ForegroundColor Yellow
    Write-Host $minified.Substring(0, [Math]::Min(200, $minified.Length)) -ForegroundColor DarkGray
    Write-Host "..." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Longitud total: $($minified.Length) caracteres" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "ERROR al procesar el JSON: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Listo! El JSON esta en tu portapapeles" -ForegroundColor Green
Write-Host ""
