# 🔧 DEBUGGING: El problema sigue después de ejecutar SQL

El error persiste, lo que significa que algo más está pasando. Vamos a diagnosticar paso a paso.

## ⚡ PASO 1: Verifica que las Políticas se Crearon

En Supabase Dashboard, abre **SQL Editor** y ejecuta ESTO:

```sql
-- Verificar si RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'categories';

-- Listar todas las políticas de la tabla
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'categories';
```

### ✅ Resultado Esperado

Deberías ver:
```
rowsecurity: true
```

Y 2 políticas:
- `Public read access for categories` (cmd: SELECT)
- `Authenticated users can manage categories` (cmd: ALL)

### ❌ Si NO lo ves

Ve a **"PASO 2: RESET COMPLETO"** abajo

---

## 🔴 PASO 2: RESET COMPLETO (Si la verificación falló)

Si las políticas NO existen, ejecuta esto en SQL Editor:

```sql
-- RESET TOTAL de la tabla categories
DROP TABLE IF EXISTS public.categories CASCADE;

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('attraction', 'business')),
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices
CREATE UNIQUE INDEX idx_categories_name_type ON public.categories(name, type);
CREATE INDEX idx_categories_type ON public.categories(type);

-- HABILITAR RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- CREAR POLÍTICAS SIMPLES
-- Política 1: Lectura pública (sin restricciones)
CREATE POLICY "anon_category_select" ON public.categories
  FOR SELECT
  USING (true);

-- Política 2: Insertar solo usuarios autenticados
CREATE POLICY "auth_category_insert" ON public.categories
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Política 3: Actualizar solo usuarios autenticados
CREATE POLICY "auth_category_update" ON public.categories
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Política 4: Borrar solo usuarios autenticados
CREATE POLICY "auth_category_delete" ON public.categories
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Verificar que funciona
SELECT COUNT(*) as total FROM public.categories;
```

---

## 🧪 PASO 3: PRUEBA EN SUPABASE

Después de ejecutar el RESET, en el mismo SQL Editor ejecuta:

```sql
-- Test directo en la BD
SELECT id, name, icon, type FROM public.categories LIMIT 10;

-- Si no hay datos, inserta algunos para probar
INSERT INTO public.categories (name, type, icon) VALUES
('histórico', 'attraction', '🏛️'),
('naturaleza', 'attraction', '🌿'),
('restaurante', 'business', '🍽️')
ON CONFLICT DO NOTHING;

-- Verifica de nuevo
SELECT id, name, icon, type FROM public.categories ORDER BY type, name;
```

Si esto funciona en SQL Editor, el problema está en el lado del cliente.

---

## 🐛 PASO 4: PROBLEMA EN EL CÓDIGO (Si PASO 3 funcionó)

Si puedes leer las categorías directamente en SQL pero el error 400 persiste en la app, el problema es el **orden** de las órdenes en el query.

Abre [src/app/explorar/page.tsx](../../src/app/explorar/page.tsx) y **cambia esto:**

```tsx
// ❌ ACTUAL (genera POST 400)
const { data, error } = await supabase
    .from('categories')
    .select('name, icon, type')
    .order('type', { ascending: false })
    .order('name');
```

**POR ESTO:**

```tsx
// ✅ CORREGIDO
const { data, error } = await supabase
    .from('categories')
    .select('name, icon, type')
    .order('type', { ascending: false });
    // .order('name');  // Comenta o elimina este
```

O mejor aún, **simplifica a esto:**

```tsx
// ✅ MÁS SIMPLE (menos propenso a errores)
const { data, error } = await supabase
    .from('categories')
    .select('name, icon, type');
```

Repite esto en:
- `src/app/admin/page.tsx` (línea ~347)
- `src/app/profile/page.tsx` (línea ~118)

---

## 🚨 PASO 5: Si NADA funciona

Si después de TODOS los pasos anteriores sigue el error 400, **deshabilita RLS temporalmente:**

```sql
-- DESACTIVAR RLS (NOT RECOMMENDED para producción)
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- Prueba en tu app
-- Si funciona, el problema es definitivamente RLS/políticas
```

---

## ✅ VALIDACIÓN FINAL

Cuando todo funcione, deberías ver en Console:

```
✅ Categories fetched: [
  {name: "histórico", icon: "🏛️", type: "attraction"},
  {name: "naturaleza", icon: "🌿", type: "attraction"},
  ...
]
```

**NO debería haber** error 400 en Network.

---

## 📞 Información para Debugging

Corre esto en DevTools Console y pega la salida aquí:

```javascript
// En la consola del navegador
console.log('Supabase URL:', window.__SUPABASE_CONFIG__.url);
console.log('Anon Key exists:', !!window.__SUPABASE_CONFIG__.anonKey);
```

---

**Dime cuál PASO falla y te ayudaré exactamente**
