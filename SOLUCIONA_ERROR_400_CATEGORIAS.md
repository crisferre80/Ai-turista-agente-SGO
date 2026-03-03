# 🚨 ERROR 400 POST: Solución Paso a Paso

## El Problema Actual

```
POST https://gcoptrxyfjmekdtxuqns.supabase.co/rest/v1/categories 400 (Bad Request)
```

Supabase está rechazando la solicitud porque la tabla `categories` **NO TIENE RLS CONFIGURADO NI POLÍTICAS DE ACCESO**.

---

## ✅ SOLUCIÓN DIRECTA (5 minutos)

### Paso 1️⃣: Abre Supabase Dashboard

1. Ve a: https://supabase.com/dashboard
2. Inicia sesión con tu cuenta
3. **Selecciona tu proyecto** "tourist-assistant" o el que uses

### Paso 2️⃣: Abre SQL Editor

En el panel izquierdo, busca **"SQL Editor"** y haz clic

### Paso 3️⃣: Crea Nueva Query

- Presiona **"New Query"** (botón azul arriba a la derecha)
- O puedes usar una query existente vacía

### Paso 4️⃣: Copia Este SQL COMPLETO

```sql
-- SOLUCIÓN: Habilitar RLS y crear políticas de acceso para categorías

-- 1. Habilitar Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Public read access for categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.categories;

-- 3. POLÍTICA DE LECTURA: Todos pueden leer (público)
CREATE POLICY "Public read access for categories" ON public.categories
  FOR SELECT
  USING (true);

-- 4. POLÍTICA DE ESCRITURA: Solo usuarios autenticados pueden crear/editar/borrar
CREATE POLICY "Authenticated users can manage categories" ON public.categories
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Verificar que todo funciona
SELECT count(*) as total_categories FROM public.categories;
```

### Paso 5️⃣: Ejecuta el SQL

- Presiona **"RUN"** (botón azul arriba a la derecha)
- Espera 2-3 segundos
- Deberías ver: `✅ Success` en la parte inferior

### Paso 6️⃣: Verifica en tu App

En la aplicación:
1. Abre **DevTools** (F12)
2. Ve a **Console**
3. **Recarga la página** (Ctrl+R)
4. Busca el error `400` en las categorías
5. **Debería desaparecer** ✅

---

## 🔍 Por qué funciona

| Estado | RLS | Políticas | Resultado |
|--------|-----|-----------|-----------|
| ❌ Antes | NO | NO | 400 Bad Request |
| ✅ Después | SÍ | SÍ | SELECT funciona |

Supabase **requiere** que todas las tablas tengan:
- ✅ RLS habilitado
- ✅ Al menos 1 política de acceso definida

---

## 🆘 Si No Funciona

### Opción A: Ejecutar en la CLI (si tienes Supabase CLI)

```bash
supabase db push
```

### Opción B: Verificar políticas existentes

En SQL Editor, ejecuta esto para ver qué políticas existen:

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'categories';
```

### Opción C: Resetear completamente

Si todo falla, elimina todo y crea desde cero:

```sql
-- ⚠️ SOLO si lo demás no funciona
DROP TABLE IF EXISTS public.categories CASCADE;

-- Luego ejecuta toda la migración desde cero
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('attraction', 'business')),
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for categories" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage categories" ON public.categories
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

---

## 📱 Páginas Afectadas (que se arreglan)

- ✅ `src/app/explorar/page.tsx` - Carga de categorías
- ✅ `src/app/admin/page.tsx` - Gestión de categorías
- ✅ `src/app/profile/page.tsx` - Selección de categorías favoritas

---

## 💡 Tips Importantes

- **No necesitas reiniciar nada** la app después de ejecutar
- Supabase cachea políticas durante ~15seg, espera a recargar
- El SQL se ejecuta **instantáneamente** en la BD
- Todas las solicitudes futuras deberían funcionar

---

## 📞 Soporte

Si aún no funciona después de esto, check:

1. ¿Ejecutaste el SQL sin errores? (debe decir ✅ Success)
2. ¿Recargaste la página del navegador? (Ctrl+R o Cmd+R)
3. ¿Limpias el cache? (DevTools → Application → Clear Site Data)
4. ¿El proyecto es el correcto? (verifica URL en Supabase)

---

**Creado:** 3 de Marzo de 2026
**Migración:** `supabase/migrations/20260303_fix_categories_rls.sql`
