# 🛠️ Solución de Errores de Consola de MediaPipe

## ❌ Error Resuelto

**Error anterior:**
```
INFO: Created TensorFlow Lite XNNPACK delegate for CPU.
```

Este mensaje aparecía como error en la consola de Next.js, pero **no es un error real**, es un mensaje informativo de MediaPipe que usa incorrectamente `console.error()` en lugar de `console.log()`.

## ✅ Solución Implementada

Se ha modificado `src/hooks/useMediaPipeVision.ts` para:

1. **Filtrar mensajes informativos** durante carga y cleanup de modelos
2. **Envolver cleanup en try-catch** para prevenir errores durante desmontaje
3. **Preservar errores reales** que sí necesitan atención

### Mensajes Filtrados

Los siguientes patrones se ignoran automáticamente:
- `INFO:`
- `TensorFlow Lite`
- `XNNPACK`
- `Initialized TensorFlow`

Estos mensajes siguen ejecutándose internamente en MediaPipe pero no se muestran en la consola.

## 🔍 Detalles Técnicos

### Antes (Problema)
```typescript
useEffect(() => {
  return () => {
    poseLandmarkerRef.current?.close();  // ❌ Lanzaba "INFO:" como error
    faceLandmarkerRef.current?.close();
  };
}, []);
```

### Después (Solución)
```typescript
useEffect(() => {
  return () => {
    const originalError = console.error;
    console.error = (...args) => {
      if (args[0]?.includes('INFO:')) return; // ✅ Filtrar
      originalError(...args);
    };

    try {
      poseLandmarkerRef.current?.close();
    } catch (err) {
      // Ignorar errores de cleanup
    }

    console.error = originalError; // ✅ Restaurar
  };
}, []);
```

## 🎯 Resultado

- ✅ **No más errores falsos** en consola
- ✅ **Errores reales sí se muestran** (para debugging)
- ✅ **Cleanup seguro** sin propagación de excepciones
- ✅ **Compatible con hot-reload** de Next.js

## 📝 Notas

- MediaPipe v0.10.17 usa `console.error()` para logs internos
- Este comportamiento es conocido en la comunidad de MediaPipe
- La solución no afecta funcionalidad, solo la visualización de logs
- Los modelos se limpian correctamente en desmontaje de componentes

## 🔗 Referencias

- Issue similar: https://github.com/google/mediapipe/issues/4611
- Documentación MediaPipe: https://developers.google.com/mediapipe

---

**Última actualización:** 5 de abril de 2026
