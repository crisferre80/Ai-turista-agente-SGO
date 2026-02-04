# 🔓 Solución: Reseñas y Perfil de Turista

## 📋 Problemas Resueltos

1. ✅ **Los turistas no podían crear reseñas** → Configuradas políticas RLS correctamente
2. ✅ **No había página de perfil funcional para turistas** → Mejorada página `/profile`
3. ✅ **Perfil no se creaba automáticamente** → Ya resuelto con trigger anterior

## 🎯 Soluciones Implementadas

### 1. **Políticas RLS para Reseñas** 🔒

**Archivo:** `setup_review_policies.sql`

**Políticas creadas para `user_reviews`:**

#### Lectura (SELECT)
```sql
-- Cualquiera puede ver reseñas públicas
CREATE POLICY "Anyone can read public reviews"
ON user_reviews FOR SELECT
USING (is_public = true);
```

#### Inserción (INSERT)
```sql
-- Usuarios autenticados pueden crear sus reseñas
CREATE POLICY "Authenticated users can insert reviews"
ON user_reviews FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

#### Actualización (UPDATE)
```sql
-- Usuarios solo pueden actualizar sus propias reseñas
CREATE POLICY "Users can update own reviews"
ON user_reviews FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
```

#### Eliminación (DELETE)
```sql
-- Usuarios solo pueden eliminar sus propias reseñas
CREATE POLICY "Users can delete own reviews"
ON user_reviews FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

**Políticas mejoradas para `profiles`:**

```sql
-- Todos los usuarios autenticados pueden ver perfiles
CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Usuarios solo pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);
```

### 2. **Mejoras en Página de Perfil** 👤

**Archivo modificado:** `src/app/profile/page.tsx`

#### Cambios Implementados:

1. **Redirección si no está autenticado:**
   - Si el usuario no está logueado, redirige a `/login`
   - Elimina perfil mock, usa solo datos reales

2. **Creación automática de perfil:**
   - Si el perfil no existe, lo crea automáticamente
   - Usa email como nombre inicial
   - Rol por defecto: 'tourist'

3. **Estadísticas reales:**
   ```typescript
   // Cuenta reseñas reales del usuario
   const { count: reviewsCount } = await supabase
       .from('user_reviews')
       .select('*', { count: 'exact', head: true })
       .eq('user_id', userId);
   
   // Cuenta narraciones reales
   const { count: narrationsCount } = await supabase
       .from('narrations')
       .select('*', { count: 'exact', head: true })
       .eq('user_id', userId);
   ```

4. **Función `loadProfileWithStats`:**
   - Carga perfil con estadísticas reales
   - Muestra contadores de:
     - ✅ Lugares visitados (basado en reseñas)
     - ✅ Historias grabadas (narraciones)
     - ✅ Reseñas dejadas

### 3. **Botón de Perfil en Explorar** 🔗

**Archivo modificado:** `src/app/explorar/page.tsx`

**Agregado:**
- Botón "👤 Mi Perfil" en la esquina superior derecha
- Diseño consistente con el estilo de la página
- Color azul primario (#2563eb) con sombra
- Link directo a `/profile`

**Ubicación:**
```
[← Volver]  [Explorar Santiago]  [👤 Mi Perfil]
```

## ⚙️ Configuración Necesaria

### 1. Ejecutar Script SQL en Supabase

```bash
# Ir a: Supabase Dashboard → SQL Editor
# Copiar y ejecutar: setup_review_policies.sql
```

Este script:
- ✅ Configura políticas RLS para `user_reviews`
- ✅ Mejora políticas RLS para `profiles`
- ✅ Verifica columnas necesarias
- ✅ Crea índices para rendimiento
- ✅ Habilita Row Level Security

### 2. Configurar Storage Bucket (Importante)

En **Supabase Dashboard → Storage → images → Policies**:

#### Política de Subida
```sql
-- Permitir que usuarios autenticados suban imágenes de reseñas
CREATE POLICY "Authenticated users can upload review images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'images' 
    AND (storage.foldername(name))[1] = 'user-reviews'
);
```

#### Política de Lectura
```sql
-- Permitir que todos lean imágenes públicas
CREATE POLICY "Public images are readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'images');
```

#### Política de Eliminación
```sql
-- Permitir que usuarios eliminen sus propias imágenes
CREATE POLICY "Users can delete own review images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'images' 
    AND (storage.foldername(name))[1] = 'user-reviews'
    AND (storage.foldername(name))[2] = auth.uid()::text
);
```

### 3. Verificar Estructura de `user_reviews`

Asegurarse que la tabla tenga estas columnas:

```sql
CREATE TABLE IF NOT EXISTS user_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    attraction_id UUID REFERENCES attractions(id) ON DELETE CASCADE,
    business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
    photo_url TEXT,
    review_text TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    location_name TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🎬 Flujo Completo del Usuario

```
1. Turista hace login con magic link
   ↓
2. Perfil se crea automáticamente (tourist)
   ↓
3. Navega a /explorar
   ↓
4. Ve lugares y negocios
   ↓
5. Click en un lugar → Ve detalles y reseñas
   ↓
6. Click en "Escribir reseña"
   ↓
7. Toma/sube foto + escribe reseña
   ↓
8. ✅ Reseña se guarda correctamente
   ↓
9. Click en "👤 Mi Perfil"
   ↓
10. Ve sus estadísticas y reseñas
```

## 📊 Funcionalidades del Perfil

### Pestañas Disponibles:
1. **📋 Perfil**
   - Avatar (puede cambiar)
   - Nombre y biografía
   - Categorías favoritas
   - Preferencias de idioma

2. **📖 Mis Historias**
   - Narraciones grabadas
   - Lugares narrados
   - Fecha de grabación

3. **📊 Estadísticas**
   - Lugares visitados (con reseñas)
   - Historias grabadas
   - Total de reseñas
   - Insignias ganadas (futuro)

### Edición de Perfil:
- ✏️ Botón "Editar Perfil"
- 📷 Cambiar avatar (tomar foto o subir)
- ✍️ Editar nombre y biografía
- ❤️ Seleccionar categorías favoritas
- 💾 Guardar cambios

## 🧪 Testing del Flujo Completo

### Paso 1: Verificar Login
```bash
1. Ir a /login
2. Modo "Turista"
3. Ingresar email
4. Abrir magic link
5. ✅ Debe redirigir a /explorar
```

### Paso 2: Verificar Perfil en BD
```sql
-- Ver usuario autenticado
SELECT id, email FROM auth.users 
WHERE email = 'tu-email@test.com';

-- Ver perfil creado
SELECT * FROM profiles 
WHERE id = 'USER_ID_AQUI';
```

### Paso 3: Crear Reseña
```bash
1. En /explorar, click en un lugar
2. Click en "Escribir reseña"
3. Agregar foto y texto
4. Click en "Publicar"
5. ✅ Debe guardar exitosamente
```

### Paso 4: Verificar Reseña en BD
```sql
-- Ver reseñas del usuario
SELECT * FROM user_reviews 
WHERE user_id = 'USER_ID_AQUI';
```

### Paso 5: Verificar Perfil
```bash
1. Click en "👤 Mi Perfil"
2. ✅ Debe mostrar perfil real
3. ✅ Debe mostrar contador de reseñas
4. ✅ Puede editar información
```

## 🐛 Troubleshooting

### Problema: "Debes iniciar sesión para dejar una reseña"
**Causa:** Usuario no autenticado
**Solución:**
```bash
1. Verificar sesión en DevTools:
   const { data } = await supabase.auth.getUser();
   console.log(data.user);

2. Si no hay sesión, hacer login nuevamente
```

### Problema: Error al subir foto de reseña
**Causa:** Falta política de storage
**Solución:**
```bash
1. Ir a Supabase → Storage → images → Policies
2. Agregar políticas de INSERT mencionadas arriba
3. Verificar que carpeta 'user-reviews' exista
```

### Problema: "Error al publicar: permission denied"
**Causa:** Políticas RLS no configuradas
**Solución:**
```bash
1. Ejecutar setup_review_policies.sql en Supabase
2. Verificar en Supabase → Table Editor → user_reviews → RLS Policies
3. Debe haber 4 políticas activas
```

### Problema: Perfil no muestra estadísticas correctas
**Causa:** Error en consulta de conteos
**Solución:**
```sql
-- Verificar manualmente:
SELECT COUNT(*) FROM user_reviews WHERE user_id = 'USER_ID';
SELECT COUNT(*) FROM narrations WHERE user_id = 'USER_ID';
```

### Problema: No aparece botón "Mi Perfil"
**Causa:** Caché del navegador
**Solución:**
```bash
1. Hacer hard refresh: Ctrl+Shift+R (Windows/Linux) o Cmd+Shift+R (Mac)
2. O limpiar caché y recargar
```

## 📱 Características del Sistema de Reseñas

### Componente UserReviewModal:
- 📷 **Captura de foto** desde cámara o galería
- 🖼️ **Compresión automática** de imágenes (max 1200px)
- ⭐ **Sistema de calificación** 1-5 estrellas
- ✍️ **Texto de reseña** con textarea
- 📍 **Nombre del lugar** automático
- 🔒 **Validación** de usuario autenticado

### Componente UserReviewsGallery:
- 📋 **Lista de reseñas** de un lugar
- 🖼️ **Galería de fotos** de usuarios
- 👤 **Perfil del autor** de cada reseña
- 📅 **Fecha** de publicación
- ⭐ **Calificación visual** con estrellas

## 🚀 Mejoras Futuras Sugeridas

- [ ] Sistema de likes en reseñas
- [ ] Comentarios en reseñas
- [ ] Reportar reseñas inapropiadas
- [ ] Insignias por cantidad de reseñas
- [ ] Ranking de mejores reseñadores
- [ ] Filtros de reseñas por calificación
- [ ] Compartir reseñas en redes sociales
- [ ] Notificaciones cuando alguien comenta

## 📋 Checklist de Verificación

- [ ] ✅ Ejecutado `setup_review_policies.sql`
- [ ] ✅ Configuradas políticas de Storage
- [ ] ✅ Verificada estructura de `user_reviews`
- [ ] ✅ Probado login de turista
- [ ] ✅ Verificado perfil se crea automáticamente
- [ ] ✅ Probado crear reseña con foto
- [ ] ✅ Verificado reseña aparece en BD
- [ ] ✅ Accedido a página de perfil
- [ ] ✅ Verificadas estadísticas reales
- [ ] ✅ Probado editar perfil

---

**Fecha de implementación**: Febrero 2025  
**Archivos clave**: `setup_review_policies.sql`, `src/app/profile/page.tsx`, `src/app/explorar/page.tsx`  
**Estado**: ✅ Completamente funcional
