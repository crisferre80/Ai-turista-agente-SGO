# 🔧 Solución al Problema de Puerto 3000 Ocupado

## 🚨 El Problema

Next.js con Turbopack a veces deja procesos `node.exe` ejecutándose en segundo plano que ocupan el puerto 3000, incluso después de cerrar la terminal o detener el servidor con `Ctrl+C`.

## 🎯 Causas Principales

### 1. **Procesos en Background**
Cuando se ejecuta `npm run dev` con el parámetro `isBackground=true` en las herramientas de desarrollo, el proceso puede quedar huérfano.

### 2. **Errores de Compilación**
Si Next.js encuentra errores durante el inicio, puede fallar al registrar los handlers de señales apropiados, dejando el proceso activo.

### 3. **Cierre Forzado**
Cerrar la terminal sin usar `Ctrl+C` o sin esperar a que el proceso termine puede dejar procesos zombie.

### 4. **Turbopack en Desarrollo**
Turbopack (el nuevo bundler de Next.js) a veces no libera el puerto correctamente cuando se reinicia rápidamente.

## ✅ Soluciones

### Opción 1: Script PowerShell Automático (Recomendado)

```powershell
.\kill-port-3000.ps1
```

Este script:
- Encuentra automáticamente el proceso en el puerto 3000
- Lo termina de forma segura
- Verifica que el puerto quedó libre

### Opción 2: Comando Manual Rápido

```powershell
# Encontrar el PID
netstat -ano | findstr :3000

# Terminar el proceso (reemplaza XXXXX con el PID encontrado)
taskkill /PID XXXXX /F
```

### Opción 3: Terminar Todos los Procesos Node.js

```powershell
taskkill /f /im node.exe
```

⚠️ **Cuidado:** Esto terminará TODOS los procesos de Node.js, no solo el del puerto 3000.

## 🛠️ Prevención

### 1. **Usar el Script Antes de Iniciar**

Agrega al `package.json`:

```json
{
  "scripts": {
    "predev": "powershell -ExecutionPolicy Bypass -File ./kill-port-3000.ps1",
    "dev": "next dev --turbopack"
  }
}
```

### 2. **Siempre Usar Ctrl+C**

Detén el servidor con `Ctrl+C` y espera a que termine completamente antes de cerrar la terminal.

### 3. **Verificar Puerto Antes de Iniciar**

```powershell
netstat -ano | findstr :3000
```

Si devuelve algo, el puerto está ocupado.

## 🔍 Por Qué Pasa Esto

### Next.js + Turbopack
Next.js 16.x con Turbopack crea múltiples procesos worker:
- Proceso principal (`next dev`)
- Workers de Turbopack (compilación)
- Hot Module Reload (HMR) server

Cuando el proceso principal se termina abruptamente, los workers pueden quedar activos.

### Solución en el Código

El problema no está en tu código, es una característica conocida de Next.js en desarrollo. No afecta producción.

## 📊 Verificación

Para confirmar que el puerto está libre:

```powershell
# Ver todos los puertos en uso
netstat -ano | findstr LISTENING

# Verificar específicamente el 3000
netstat -ano | findstr :3000
```

Si no devuelve nada → ✅ Puerto libre  
Si devuelve algo → ⚠️ Puerto ocupado

## 🎯 Flujo de Trabajo Recomendado

1. **Antes de desarrollar:**
   ```powershell
   .\kill-port-3000.ps1
   npm run dev
   ```

2. **Al terminar:**
   - Presiona `Ctrl+C` en la terminal
   - Espera a que diga "Process terminated"
   - Ejecuta `.\kill-port-3000.ps1` por seguridad

3. **Si hay error:**
   ```powershell
   .\kill-port-3000.ps1
   npm run dev
   ```

## 🚀 Solución Permanente (Opcional)

Si el problema persiste constantemente, considera:

### Cambiar el Puerto por Defecto

En `package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbopack -p 3001"
  }
}
```

O crear un archivo `.env.local`:

```env
PORT=3001
```

### Usar el Script Pre-hook

Modifica `package.json`:

```json
{
  "scripts": {
    "dev": "powershell -Command \"& { $p = Get-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue; if($p){ Stop-Process $p.Id -Force }; next dev --turbopack }\"",
    "dev:simple": "next dev --turbopack"
  }
}
```

## 📝 Notas

- Este es un problema común en desarrollo con Next.js/Turbopack
- No afecta la aplicación en producción
- Los scripts de limpieza son seguros de usar repetidamente
- Si usas VS Code, cierra y abre la terminal integrada si el problema persiste

## 🆘 Ayuda Adicional

Si el problema continúa después de aplicar estas soluciones:

1. Reinicia VS Code completamente
2. Verifica que no tengas múltiples instancias de VS Code abiertas con el mismo proyecto
3. Reinicia tu PC (esto limpiará todos los procesos zombie)

---

**Creado:** 13 de febrero de 2026  
**Última actualización:** 13 de febrero de 2026
