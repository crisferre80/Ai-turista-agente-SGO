const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan variables de entorno de Supabase');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupEmailImagesBucket() {
    try {
        console.log('Creando bucket email-images...');

        // Crear bucket
        const { data, error } = await supabase.storage.createBucket('email-images', {
            public: true
        });

        if (error && !error.message.includes('already exists')) {
            throw error;
        }

        console.log('Bucket creado exitosamente');

        // Crear políticas (esto requiere permisos de admin)
        console.log('Configurando políticas...');

        // Nota: Las políticas de storage se deben crear desde SQL
        // Este script solo crea el bucket

        console.log('Setup completado');
    } catch (error) {
        console.error('Error:', error);
    }
}

setupEmailImagesBucket();