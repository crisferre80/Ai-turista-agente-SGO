// Script de prueba para verificar que las categorías se cargan en el frontend
// Agregar temporalmente a explorar/page.tsx para testing

// Agregar esta función después de fetchCategories
const testCategoriesQuery = async () => {
    console.log('🧪 Testing categories query...');
    try {
        const { data, error, count } = await supabase
            .from('categories')
            .select('*', { count: 'exact' });

        console.log('🧪 Query result:', { data, error, count });
        return { data, error, count };
    } catch (err) {
        console.error('🧪 Query exception:', err);
        return { data: null, error: err, count: null };
    }
};

// Llamar en useEffect para testing
useEffect(() => {
    fetchData();
    fetchCategories();
    testCategoriesQuery(); // Agregar esta línea para testing