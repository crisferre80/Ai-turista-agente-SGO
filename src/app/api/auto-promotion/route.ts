import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Llamar al scheduler para obtener promociones que deben ejecutarse
    const schedulerResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/auto-promotions/scheduler`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!schedulerResponse.ok) {
      console.error('Error calling scheduler:', schedulerResponse.statusText);
      return NextResponse.json({ promotion: null, shouldShow: false });
    }

    const schedulerData = await schedulerResponse.json();
    
    if (!schedulerData.success || !schedulerData.promotions || schedulerData.promotions.length === 0) {
      return NextResponse.json({ promotion: null, shouldShow: false });
    }

    // Tomar la promoción con mayor prioridad (ya están ordenadas)
    const promotion = schedulerData.promotions[0];

    return NextResponse.json({
      promotion: {
        id: promotion.id,
        title: promotion.title,
        message: promotion.message,
        business_name: promotion.business_name,
        priority: promotion.priority
      },
      shouldShow: true,
      metadata: {
        total_promotions_scheduled: schedulerData.count,
        current_time: schedulerData.current_time,
        timestamp: schedulerData.timestamp
      }
    });

  } catch (error) {
    console.error('Error obteniendo promoción automática:', error);
    return NextResponse.json({ promotion: null, shouldShow: false });
  }
}