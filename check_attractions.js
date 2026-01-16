const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gcoptrxyfjmekdtxuqns.supabase.co',
  'sb_publishable_v4-BuEckSPeeILmHhNbWYw_rtDNhVKW'
);

async function checkAttractions() {
  const { data, error } = await supabase.from('attractions').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Atractivos registrados:');
    data.forEach(item => console.log('-', item.name, 'lat:', item.lat, 'lng:', item.lng));
  }
}

checkAttractions();

async function addAttraction(name, description, lat, lng) {
  const { data, error } = await supabase.from('attractions').insert([
    {
      name,
      description,
      lat,
      lng,
      category: 'Termas'
    }
  ]);
  if (error) {
    console.error('Error inserting:', error);
  } else {
    console.log('Inserted:', data);
  }
}

// checkAttractions();

// Agregar Termas de Río Hondo
// addAttraction(
//   'Termas de Río Hondo',
//   'Las Termas de Río Hondo son un complejo termal ubicado en la provincia de Santiago del Estero, Argentina. Conocidas por sus aguas termales naturales y su infraestructura turística.',
//   -27.4969, // lat
//   -64.8620  // lng
// );