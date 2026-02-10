# 🔐 Cambio a Autenticación Tradicional (Email/Password)

## ✅ Problemas Resueltos

### 1. Campo `bio` faltante en la tabla `profiles`
- **Error**: `400 Bad Request` en `/rest/v1/profiles` - campo `bio` no existe
- **Solución**: Ejecutar `fix_profiles_add_bio.sql` para agregar la columna

### 2. Botón "Dejar Reseña" no visible
- **Problema**: El botón solo aparecía cuando NO había reseñas
- **Solución**: Ahora aparece SIEMPRE cuando estás en la página de un lugar específico, con un diseño destacado

### 3. Sesión NO persiste - se pierde al navegar
- **Problema**: El sistema de Magic Links requería re-autenticación cada vez que se perdía la sesión
- **Solución**: Cambiado a autenticación tradicional **Email + Contraseña** con persistencia automática

---

## 🆕 Nuevo Sistema de Autenticación para Turistas

### Características
✅ **Persistencia automática**: La sesión se mantiene incluso al cerrar/navegar
✅ **Sin magic links**: Ya no es necesario revisar el email cada vez
✅ **Login/Registro tradicional**: Email y contraseña como cualquier app moderna
✅ **UX mejorada**: Botón toggle claro entre "Ingresar" y "Crear cuenta"

### Flujo de Usuario

#### **Primera vez (Registro)**
1. Usuario elige tab "Turista"
2. Click en "¿Primera vez? Creá tu cuenta"
3. Ingresa email y contraseña
4. Click en "🎉 Crear Cuenta"
5. Recibe email de confirmación de Supabase
6. Confirma email y ya puede iniciar sesión

#### **Usuario existente (Login)**
1. Usuario elige tab "Turista"
2. Ingresa email y contraseña
3. Click en "Ingresar"
4. Redirige a `/explorar`
5. ✅ **Sesión persiste** - no necesita volver a ingresar

### Comparación: Antes vs Ahora

| Aspecto | Antes (Magic Links) | Ahora (Email/Password) |
|---------|-------------------|----------------------|
| **Primera vez** | Enviar email → Revisar inbox → Click link | Email + Password → Confirmar email |
| **Re-login** | Enviar email nuevamente → Revisar inbox | Email + Password → Entrar |
| **Persistencia** | ❌ Se pierde al navegar | ✅ Se mantiene automáticamente |
| **UX** | Confusa - no quedaba claro | Clara - flujo estándar |
| **Tiempo** | ~1-2 minutos por sesión | ~10 segundos |

---

## 📋 Pasos de Implementación

### 1. Ejecutar SQL en Supabase

```sql
-- Agregar campo bio a profiles
\i fix_profiles_add_bio.sql

-- Configurar políticas de autenticación (opcional)
\i setup_email_password_auth.sql
```

### 2. Configurar Supabase Dashboard

#### Habilitar Email/Password Provider
1. Ir a: **Authentication** → **Providers**
2. Verificar que **Email** esté habilitado
3. Configurar:
   - ✅ Enable email provider
   - ✅ Confirm email (recomendado para producción)
   - ❌ Secure email change (opcional)

#### Configurar URLs de Redirección
1. Ir a: **Authentication** → **URL Configuration**
2. Agregar:
   - Development: `http://localhost:3000`
   - Production: `https://tu-dominio.com`

#### Configurar Sesiones (opcional)
1. Ir a: **Authentication** → **Settings**
2. Configurar tiempos:
   - **JWT Expiry**: 3600 (1 hora) - se renueva automáticamente
   - **Refresh Token Lifetime**: 2592000 (30 días) - sesión máxima

### 3. Verificar Políticas RLS

Las políticas de `profiles` y `user_reviews` ya están configuradas en `setup_review_policies.sql`.

---

## 🔧 Cambios en el Código

### Archivos Modificados

#### `src/app/login/page.tsx`
**Antes:**
```typescript
// Tourist: send magic link via Supabase
const { data, error: authError } = await supabase.auth.signInWithOtp({ 
    email,
    options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
    }
});
```

**Ahora:**
```typescript
if (isRegistering) {
    // Registro nuevo de turista
    const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: 'tourist' } }
    });
} else {
    // Login turista existente
    const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
    });
}
```

#### `src/components/UserReviewsGallery.tsx`
**Cambio:** Botón "Dejar Reseña" ahora aparece SIEMPRE (cuando `placeId` existe), no solo cuando no hay reseñas.

```typescript
{placeId && (
    <div style={{ /* diseño destacado */ }}>
        <button onClick={() => setShowModal(true)}>
            ✨ Dejar mi Reseña
        </button>
    </div>
)}
```

---

## 🧪 Testing

### Escenarios a Probar

#### 1. Registro nuevo turista
- [ ] Formulario acepta email y contraseña
- [ ] Se envía email de confirmación
- [ ] Después de confirmar, puede iniciar sesión
- [ ] Se crea perfil automáticamente en tabla `profiles`

#### 2. Login turista existente
- [ ] Email y contraseña correctos → redirige a `/explorar`
- [ ] Sesión se mantiene al navegar entre páginas
- [ ] Sesión se mantiene al cerrar y reabrir navegador
- [ ] Botón "Mi Perfil" funciona correctamente

#### 3. Botón dejar reseña
- [ ] Aparece en `/explorar/[id]` para cada lugar
- [ ] Al hacer click, abre modal de reseña
- [ ] Usuario autenticado puede dejar reseña
- [ ] Usuario no autenticado es redirigido a login

#### 4. Campo bio en perfil
- [ ] `/profile` carga sin error 400
- [ ] Campo bio se puede editar y guardar
- [ ] No hay errores en consola sobre campo faltante

---

## 🐛 Troubleshooting

### Error: "Email confirmations are disabled"
**Solución:** En Supabase Dashboard → Authentication → Providers → Email → Desmarcar "Confirm email"

### Error: "User already registered"
**Causa:** Intentando registrar con email ya existente
**Solución:** Usar el botón "¿Ya tenés cuenta? Ingresá" para login

### Sesión sigue sin persistir
1. Verificar que `supabase.auth.getSession()` no tenga errores
2. Revisar localStorage del navegador - debe haber keys de Supabase
3. Verificar que no haya `signOut()` accidental en navegación

### Error 400 en profiles
**Causa:** Campo `bio` no agregado a la tabla
**Solución:** Ejecutar `fix_profiles_add_bio.sql` en Supabase SQL Editor

---

## 📊 Ventajas del Nuevo Sistema

### Para el Usuario
- ✅ Más rápido (10 segundos vs 1-2 minutos)
- ✅ Más familiar (flujo estándar de apps)
- ✅ No depende del email cada vez
- ✅ Sesión persiste automáticamente

### Para el Desarrollo
- ✅ Menos complejidad (no necesita callback page especializada)
- ✅ Mejor debugging (errores más claros)
- ✅ Funciona offline (una vez autenticado)
- ✅ Compatible con todas las features de Supabase Auth

---

## 🔄 Rollback (si es necesario)

Si necesitas volver al sistema de Magic Links:

1. Revertir cambios en `src/app/login/page.tsx`:
   - Cambiar `signInWithPassword()` por `signInWithOtp()`
   - Remover campo password del formulario
   - Remover toggle login/registro

2. Restaurar página callback: `src/app/auth/callback/page.tsx`

3. El campo `bio` en profiles puede quedarse (no causa problemas)

---

## 📝 Notas Adicionales

### Compatibilidad con Negocios y Admin
- ✅ El sistema de negocios y admin **no fue modificado**
- ✅ Siguen usando email/password tradicional
- ✅ Solo los turistas cambiaron de Magic Links → Email/Password

### Migración de Usuarios Existentes
- ❌ Usuarios que usaron Magic Links NO pueden usar su email anterior automáticamente
- ✅ Deben "registrarse" nuevamente con contraseña
- ⚠️ Considera enviar email notificando el cambio

### Seguridad
- ✅ Supabase maneja hash de contraseñas (bcrypt)
- ✅ Tokens JWT con expiración configurable
- ✅ Refresh tokens para renovación automática
- ✅ RLS policies protegen datos de usuarios

---

## 📞 Soporte

Si encuentras problemas:
1. Revisar logs del navegador (F12 → Console)
2. Revisar logs de Supabase (Dashboard → Logs)
3. Verificar políticas RLS en tabla profiles
4. Consultar documentación de Supabase Auth: https://supabase.com/docs/guides/auth
