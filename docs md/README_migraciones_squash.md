# Migraciones (squash)

Este repo fue “squasheado” para que el esquema de la app se cree con **3 migraciones** limpias.

## Carpeta

- `supabase/migrations/`
  - `20260212000000_baseline_schema.sql` → Tablas, índices, triggers y compatibilidad.
  - `20260212000010_rls_and_storage.sql` → RLS + buckets/policies de Storage.
  - `20260212000020_seed_minimal.sql` → Seeds mínimos (categorías, planes, app_settings).

- `supabase/migrations_legacy/`
  - Contiene todas las migraciones anteriores (histórico). No se ejecutan por defecto.

## Importante (evitar pérdida de datos)

- **NO uses** `npx supabase db reset --linked` contra una base con datos: puede resetear la base remota.
- Para desarrollo local usa `npx supabase db reset` (sin `--linked`).
- Para aplicar cambios a remoto usa `npx supabase db push` (y revisa el SQL antes).

## Nota sobre RLS

Con estas migraciones, la app asume:

- Lectura pública para `attractions`, `categories`, `app_videos`, `promotions`, `carousel_photos` (solo activas donde corresponde).
- Escritura restringida a admin (según `profiles.role = 'admin'`).
- Escritura/lectura propia para `profiles`, `business_profiles`, `user_reviews`, `narrations`.

Si querés un modo “sin RLS” para desarrollo rápido, se puede generar una variante que deje RLS deshabilitado.
