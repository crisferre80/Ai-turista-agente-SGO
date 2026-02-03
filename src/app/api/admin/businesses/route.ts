import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Lista de negocios predeterminados para el sistema de promociones
    const businesses = [
      { id: '1', name: 'Restaurante El Buen Sabor', category: 'Gastronomía' },
      { id: '2', name: 'Hotel Plaza Santiago', category: 'Hospedaje' },
      { id: '3', name: 'Café Central', category: 'Cafetería' },
      { id: '4', name: 'Parrilla La Tradición', category: 'Parrilla' },
      { id: '5', name: 'Hotel Colonial', category: 'Hospedaje' },
      { id: '6', name: 'Museo de Arte Popular', category: 'Cultura' },
      { id: '7', name: 'Complejo Termal', category: 'Turismo' },
      { id: '8', name: 'Centro Comercial', category: 'Compras' },
      { id: '9', name: 'Agencia de Turismo', category: 'Servicios' },
      { id: '10', name: 'Casa de Empanadas', category: 'Gastronomía' }
    ];

    return NextResponse.json({ businesses });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}