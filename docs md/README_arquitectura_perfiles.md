# 🏗️ ARQUITECTURA DE PERFILES - DOCUMENTACIÓN

## 📊 Estructura de Tablas

### 1. `profiles` (Tabla Base)
**Propósito**: Almacenar información básica de TODOS los usuarios (turistas, negocios, admins)

**Campos principales**:
```sql
- id (UUID) → FK a auth.users.id
- name (TEXT)
- email (TEXT)
- avatar_url (TEXT)
- role (TEXT) → 'tourist' | 'business' | 'admin'
- created_at (TIMESTAMP)
```

### 2. `business_profiles` (Tabla Extendida para Negocios)
**Propósito**: Almacenar información COMPLETA solo de negocios

**Campos principales**:
```sql
- id (UUID PRIMARY KEY)
- auth_id (UUID) → FK a auth.users.id
- name, email, phone, address, city, country
- description, website_url, category
- avatar_url, cover_image_url
- instagram_url, facebook_url, whatsapp
- plan ('basic' | 'pro' | 'premium')
- is_active, is_verified
- gallery_images (TEXT[])
- lat, lng (coordenadas)
```

### 3. `businesses` (Vista - NO es tabla)
**Propósito**: Alias/vista de `business_profiles` para retrocompatibilidad

```sql
CREATE VIEW businesses AS 
SELECT * FROM business_profiles;
```

---

## 🔄 Flujo de Registro

### TURISTAS
```
1. auth.signUp(email, password)
   └─ Trigger 'on_auth_user_created' → Crea en profiles con role='tourist'
2. ✅ FIN (solo necesita profiles)
```

### NEGOCIOS (Corregido)
```
1. auth.signUp(email, password, { data: { role: 'business' } })
   └─ Trigger lee metadata → Crea en profiles con role='business'
   
2. UPDATE profiles 
   └─ Actualizar avatar_url, name (asegurar role='business')
   
3. INSERT INTO business_profiles
   └─ Datos completos del negocio (plan, descripción, etc.)
   
4. ✅ FIN
```

---

## 🐛 Problema que Había

### ❌ Antes (Registro Incorrecto)
```typescript
// 1. Creaba usuario SIN metadata de role
await supabase.auth.signUp({ email, password });
// ← Trigger creaba profiles con role='tourist' (default)

// 2. Intentaba INSERT en profiles (conflicto, se ignora)
await supabase.from('profiles').insert({ role: 'business' });
// ← Nunca se guardaba, quedaba como 'tourist'

// 3. Creaba en business_profiles correctamente
await supabase.from('business_profiles').insert({ ... });

// RESULTADO: Negocio con role='tourist' ❌
```

### ✅ Ahora (Registro Correcto)
```typescript
// 1. Crea usuario CON metadata de role
await supabase.auth.signUp({ 
  email, 
  password,
  options: { data: { role: 'business' } }
});
// ← Trigger usa metadata → crea profiles con role='business' ✅

// 2. UPDATE en profiles (asegurar avatar)
await supabase.from('profiles')
  .update({ avatar_url, role: 'business' })
  .eq('id', userId);

// 3. Crea en business_profiles
await supabase.from('business_profiles').insert({ ... });

// RESULTADO: Negocio con role='business' ✅
```

---

## 🔍 Lógica de Login/Redirección

```typescript
// 1. Buscar en business_profiles PRIMERO
const { data: businessRow } = await supabase
  .from('business_profiles')
  .select('id')
  .eq('auth_id', userId)
  .maybeSingle();

if (businessRow) {
  router.push('/business/profile'); // ← Dashboard de negocios
  return;
}

// 2. Si no es negocio, revisar role en profiles
const { data: profileRow } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', userId)
  .single();

if (profileRow.role === 'admin') {
  router.push('/admin');
} else if (profileRow.role === 'business') {
  router.push('/business/profile');
} else {
  router.push('/dashboard/tourist');
}
```

---

## 🛠️ Corregir Datos Existentes

### Ejecutar en Supabase SQL Editor:

```sql
-- Ver negocios con role incorrecto
SELECT p.name, p.email, p.role, bp.plan
FROM profiles p
INNER JOIN business_profiles bp ON p.id = bp.auth_id
WHERE p.role != 'business';

-- Corregir todos los roles
UPDATE profiles p
SET role = 'business'
FROM business_profiles bp
WHERE p.id = bp.auth_id
  AND p.role != 'business';
```

---

## ✅ Checklist de Verificación

- [x] `auth.signUp()` incluye `options.data.role='business'`
- [x] Registro hace UPDATE (no INSERT) en profiles
- [x] Registro crea entrada en business_profiles
- [x] Login verifica business_profiles primero
- [x] Login redirige según role correctamente
- [x] Script SQL para arreglar datos antiguos creado

---

## 📝 Archivos Modificados

1. **`src/app/business/register/page.tsx`**
   - Línea ~143: Añadido `options.data.role='business'` a signUp
   - Línea ~183: Cambiado INSERT por UPDATE en profiles

2. **`src/app/login/page.tsx`**
   - Línea ~256: Añadida redirección explícita para role='business'

3. **`scripts/fix-business-roles.sql`**
   - Script nuevo para corregir datos existentes

---

## 🎯 Resultado Final

**TURISTAS**:
- ✅ Solo en `profiles` con role='tourist'

**NEGOCIOS**:
- ✅ En `profiles` con role='business'
- ✅ En `business_profiles` con datos completos
- ✅ Redirección a `/business/profile` correcta

**ADMINS**:
- ✅ En `profiles` con role='admin'
- ✅ Redirección a `/admin` correcta
