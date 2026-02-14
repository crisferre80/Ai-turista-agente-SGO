# Script para liberar el puerto 3000
# Uso: .\kill-port-3000.ps1

Write-Host "🔍 Buscando procesos en el puerto 3000..." -ForegroundColor Cyan

$connections = netstat -ano | findstr ":3000"

if ($connections) {
    Write-Host "✅ Procesos encontrados:" -ForegroundColor Green
    Write-Host $connections
    
    # Extraer PIDs
    $pids = $connections | ForEach-Object {
        if ($_ -match '\s+(\d+)\s*$') {
            $matches[1]
        }
    } | Select-Object -Unique
    
    foreach ($pid in $pids) {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "📍 PID $pid - Proceso: $($process.ProcessName)" -ForegroundColor Yellow
            Write-Host "⚠️  Terminando proceso..." -ForegroundColor Red
            Stop-Process -Id $pid -Force
            Write-Host "✅ Proceso $pid terminado" -ForegroundColor Green
        }
    }
    
    Write-Host "`n✨ Puerto 3000 liberado exitosamente" -ForegroundColor Green
} else {
    Write-Host "✅ El puerto 3000 está libre" -ForegroundColor Green
}

# Verificar después de terminar
Write-Host "`n🔍 Verificación final..." -ForegroundColor Cyan
$verification = netstat -ano | findstr ":3000"
if ($verification) {
    Write-Host "⚠️  Aún hay procesos en el puerto 3000:" -ForegroundColor Yellow
    Write-Host $verification
} else {
    Write-Host "✅ Confirmado: Puerto 3000 completamente libre" -ForegroundColor Green
}
