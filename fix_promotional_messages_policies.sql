-- Corregir políticas RLS para promotional_messages
-- Este script corrige el error 401 Unauthorized

-- Obtener y eliminar TODAS las políticas existentes
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'promotional_messages'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON promotional_messages', pol.policyname);
    END LOOP;
END $$;

-- Crear políticas correctas separadas por operación

-- Policy 1: SELECT - Usuarios NO autenticados solo ven mensajes activos
CREATE POLICY "Public can view active promotional messages"
    ON promotional_messages FOR SELECT
    TO anon
    USING (is_active = true);

-- Policy 2: SELECT - Usuarios autenticados ven TODOS los mensajes (para admin)
CREATE POLICY "Authenticated users can view all promotional messages"
    ON promotional_messages FOR SELECT
    TO authenticated
    USING (true);

-- Policy 3: INSERT - Solo usuarios autenticados pueden insertar
CREATE POLICY "Authenticated users can insert promotional messages"
    ON promotional_messages FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy 4: UPDATE - Solo usuarios autenticados pueden actualizar
CREATE POLICY "Authenticated users can update promotional messages"
    ON promotional_messages FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy 5: DELETE - Solo usuarios autenticados pueden eliminar
CREATE POLICY "Authenticated users can delete promotional messages"
    ON promotional_messages FOR DELETE
    TO authenticated
    USING (true);

-- Verificar que funciona
SELECT 'Policies actualizadas correctamente' as status;
SELECT * FROM pg_policies WHERE tablename = 'promotional_messages';
