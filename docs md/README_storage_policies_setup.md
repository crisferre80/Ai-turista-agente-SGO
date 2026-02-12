# Configuración de Políticas RLS para Storage - ESTADO ACTUAL

## ✅ Estado Actual
- **Bucket 'images'**: ✅ Creado y configurado como público
- **Archivos**: ✅ Se pueden listar (5 archivos encontrados)
- **URLs públicas**: ✅ Se generan correctamente
- **Políticas RLS**: ❌ Faltan configurar (requiere dashboard)

## ❌ Problema Identificado
El error "Failed to fetch" ocurre porque faltan las políticas RLS que permiten el acceso desde el cliente web, aunque el bucket esté público.

## 🔧 Solución: Configurar Políticas RLS Manualmente

### Paso 1: Acceder al Dashboard de Supabase
1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto: `tourist-assistant`

### Paso 2: Ir a Storage → Policies
1. En el menú lateral, haz clic en **"Storage"**
2. Selecciona el bucket **"images"**
3. Haz clic en la pestaña **"Policies"**

### Paso 3: Crear las Políticas RLS

Crea estas 4 políticas una por una:

#### 📖 Política 1: Lectura Pública
```
Nombre: Public read access for images bucket
Operación: SELECT
WITH CHECK expression:
bucket_id = 'images'
```

#### 📤 Política 2: Subida Autenticada
```
Nombre: Authenticated users can upload to images bucket
Operación: INSERT
WITH CHECK expression:
bucket_id = 'images' AND auth.role() = 'authenticated'
```

#### ✏️ Política 3: Actualización Autenticada
```
Nombre: Authenticated users can update images bucket
Operación: UPDATE
USING expression:
bucket_id = 'images' AND auth.role() = 'authenticated'
```

#### 🗑️ Política 4: Borrado Autenticado
```
Nombre: Authenticated users can delete from images bucket
Operación: DELETE
USING expression:
bucket_id = 'images' AND auth.role() = 'authenticated'
```

### Paso 4: Verificar
Después de crear las políticas:
1. Recarga la página de administración
2. Ve a la pestaña **"Galería"**
3. Las imágenes deberían aparecer en el grid
4. El error "Failed to fetch" debería desaparecer

## 🧪 Verificación del Estado Actual

Ejecuta este comando para verificar el estado:

```bash
node scripts/test-storage-access.mjs
```

**Resultado esperado:**
- Buckets accesibles: ✅
- Bucket "images" público: ✅
- Archivos listados: ✅
- URLs generadas: ✅

## 📝 Notas Técnicas

- El bucket ya está configurado como público
- Las políticas RLS son necesarias para acceso desde el navegador
- Sin estas políticas, las llamadas desde el cliente fallan con "Failed to fetch"
- Las políticas permiten lectura pública pero requieren autenticación para escritura

## 🎯 Próximos Pasos

1. Configurar políticas RLS desde el dashboard
2. Probar la galería en la aplicación
3. Verificar que las imágenes aparecen en AR sin cubos verdes

## 🔍 Debugging Adicional

Si persisten los problemas:
1. Verifica que el usuario esté autenticado
2. Revisa la consola del navegador por errores de CORS
3. Confirma que las políticas se aplicaron correctamente en el dashboard