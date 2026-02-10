# 🔐 Flujo de Autenticación de Turistas con Magic Link

## 📋 Problema Resuelto

Cuando un turista ingresaba usando magic link (email OTP), se presentaban varios problemas:
1. ✅ El enlace redirigía a la página overlay (inicio) en lugar de la experiencia de exploración
2. ✅ No se creaba automáticamente el perfil en la tabla `profiles` con rol 'tourist'
3. ✅ El usuario aparecía autenticado en Supabase pero sin perfil en la base de datos
4. ✅ No había una página de callback dedicada para manejar el magic link

## 🔧 Soluciones Implementadas

### 1. **Página de Callback de Autenticación** ✨ NUEVO

**Archivo:** `src/app/auth/callback/page.tsx`

**Funcionalidad:**
- Maneja el callback después de hacer click en el magic link del email
- Verifica la sesión del usuario autenticado
- Crea automáticamente el perfil si no existe
- Redirige a `/explorar` (experiencia de turista)
- Maneja errores con redirección a login

**Flujo:**
```
Usuario click en email → /auth/callback → Verifica sesión → Crea perfil → Redirige a /explorar
```

### 2. **Configuración del Magic Link** 🔗

**Archivo modificado:** `src/app/login/page.tsx`

**Cambios:**
```typescript
// Antes:
await supabase.auth.signInWithOtp({ email });

// Ahora:
await supabase.auth.signInWithOtp({ 
    email,
    options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
            role: 'tourist'
        }
    }
});
```

**Beneficios:**
- Magic link ahora redirige a `/auth/callback` en lugar de la página principal
- Se incluye metadata `role: 'tourist'` para identificación
- URL de callback configurada correctamente

### 3. **Trigger de Base de Datos** 🗄️

**Archivo:** `setup_auto_profile_creation.sql`

**Funciones creadas:**

#### `handle_new_user()`
- Se ejecuta automáticamente cuando se crea un usuario en `auth.users`
- Crea perfil en `profiles` con rol del metadata o 'tourist' por defecto
- Usa `ON CONFLICT DO NOTHING` para evitar duplicados

#### `handle_updated_at()`
- Actualiza automáticamente el timestamp `updated_at` en perfiles

**Ejecutar en Supabase:**
```sql
-- Ir a SQL Editor en Supabase
-- Copiar y ejecutar el contenido de setup_auto_profile_creation.sql
```

### 4. **Fallback en Página Principal** 🏠

**Archivo modificado:** `src/app/page.tsx`

**Agregado:**
```typescript
useEffect(() => {
    // ... código existente ...
    
    // Manejar autenticación de turistas
    const checkAuthState = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, role')
                .eq('id', session.user.id)
                .maybeSingle();

            if (!profile) {
                // Crear perfil si no existe
                await supabase.from('profiles').insert({
                    id: session.user.id,
                    name: session.user.email?.split('@')[0] || 'Turista',
                    role: 'tourist'
                });
            }
        }
    };
    
    checkAuthState();
}, []);
```

**Beneficio:** Doble seguridad para crear el perfil incluso si llegan a la página principal

## 🎯 Flujo Completo del Usuario

```
1. Usuario va a /login
   ↓
2. Selecciona modo "Turista"
   ↓
3. Ingresa su email
   ↓
4. Click en "Enviar enlace"
   ↓
5. Recibe email con magic link
   ↓
6. Click en "Log In" del email
   ↓
7. Redirige a /auth/callback
   ↓
8. Callback verifica sesión
   ↓
9. Busca perfil en DB
   ↓
10. ¿Existe perfil?
    ├─ SÍ → Redirige a /explorar
    └─ NO → Crea perfil como 'tourist' → Redirige a /explorar
```

## 📁 Archivos Creados/Modificados

### Nuevos Archivos
1. ✨ `src/app/auth/callback/page.tsx` - Página de callback con UI de loading
2. ✨ `setup_auto_profile_creation.sql` - Trigger y funciones de BD

### Archivos Modificados
1. 🔧 `src/app/login/page.tsx` - Configuración de emailRedirectTo
2. 🔧 `src/app/page.tsx` - Fallback de creación de perfil

## 🗄️ Configuración en Supabase

### 1. Ejecutar Script SQL

```bash
# Abrir Supabase Dashboard
# Ir a: SQL Editor
# Ejecutar: setup_auto_profile_creation.sql
```

### 2. Verificar URL de Redirección

En Supabase Dashboard:
1. Ve a **Authentication → URL Configuration**
2. Agrega a **Redirect URLs**:
   - `http://localhost:3000/auth/callback` (desarrollo)
   - `https://tu-dominio.com/auth/callback` (producción)

### 3. Verificar Email Templates

En Supabase Dashboard:
1. Ve a **Authentication → Email Templates**
2. Template: **Magic Link**
3. Verifica que contenga: `{{ .ConfirmationURL }}`

## 🧪 Testing

### Flujo de Prueba
1. **Limpiar estado:**
   ```javascript
   // En DevTools Console
   localStorage.clear();
   sessionStorage.clear();
   ```

2. **Ir a login:**
   ```
   http://localhost:3000/login
   ```

3. **Seleccionar modo "Turista"**

4. **Ingresar email de prueba**

5. **Verificar email recibido**
   - Debe tener botón "Log In"
   - URL debe apuntar a `/auth/callback`

6. **Click en "Log In"**

7. **Verificar redirección:**
   - Debe mostrar pantalla de "Verificando acceso..."
   - Debe redirigir a `/explorar`

8. **Verificar en Supabase:**
   ```sql
   -- Ver usuarios autenticados
   SELECT * FROM auth.users 
   WHERE email = 'tu-email@test.com';
   
   -- Ver perfil creado
   SELECT * FROM profiles 
   WHERE role = 'tourist';
   ```

## 🎨 Pantalla de Callback

La página de callback muestra:
- ⏳ Spinner animado
- 📝 "Verificando acceso..."
- 🎨 Gradiente azul/rojo del branding
- ✨ Animación profesional

## 🔒 Seguridad

### RLS (Row Level Security)
Asegúrate de tener políticas en `profiles`:

```sql
-- Política de lectura
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- Política de inserción (para el trigger)
CREATE POLICY "Service role can insert profiles" 
ON profiles FOR INSERT 
WITH CHECK (true);

-- Política de actualización
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);
```

## 📊 Estructura de la Tabla Profiles

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    role TEXT CHECK (role IN ('admin', 'business', 'tourist')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🐛 Troubleshooting

### Problema: Email no llega
- ✅ Verificar configuración SMTP en Supabase
- ✅ Revisar spam/correo no deseado
- ✅ Verificar que el email esté confirmado

### Problema: Redirige a página principal
- ✅ Verificar URL en Email Template
- ✅ Verificar que `/auth/callback` exista
- ✅ Revisar Redirect URLs en Supabase

### Problema: No se crea perfil
- ✅ Ejecutar `setup_auto_profile_creation.sql`
- ✅ Verificar que el trigger esté activo
- ✅ Revisar logs en Supabase

### Problema: Error de permisos
- ✅ Verificar políticas RLS en `profiles`
- ✅ Asegurar que `auth.uid()` funcione
- ✅ Revisar que el trigger use `SECURITY DEFINER`

## 📝 Logs de Debug

**En el navegador:**
```javascript
// Ver logs de autenticación
// Buscar en Console:
✅ Sesión de turista autenticada: { userId, userEmail }
📝 Creando perfil de turista...
✅ Perfil de turista creado exitosamente
```

**En Supabase:**
```sql
-- Ver últimos usuarios creados
SELECT id, email, created_at, raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Ver últimos perfiles creados
SELECT id, name, role, created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 5;
```

## 🚀 Próximos Pasos

- [ ] Implementar perfil de usuario para turistas
- [ ] Agregar historial de lugares visitados
- [ ] Sistema de favoritos para turistas
- [ ] Reseñas y valoraciones
- [ ] Compartir experiencias en redes sociales

---

**Fecha de implementación**: Febrero 2025  
**Tecnologías**: Next.js, Supabase Auth, Magic Links, PostgreSQL Triggers  
**Estado**: ✅ Completamente funcional
