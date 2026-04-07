import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * API endpoint para obtener registros de análisis de visión
 * y estadísticas agregadas
 */
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener registros recientes (últimos 100)
    const { data: records, error: recordsError } = await supabase
      .from('vision_analysis_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (recordsError) {
      console.error('Error al obtener registros:', recordsError);
      return NextResponse.json(
        { error: 'Error al obtener registros' },
        { status: 500 }
      );
    }

    // Calcular estadísticas
    const stats = {
      totalAnalyses: records.length,
      avgPeopleCount: 0,
      avgProcessingTime: 0,
      mostCommonObjects: [] as string[],
    };

    if (records.length > 0) {
      // Promedio de personas
      stats.avgPeopleCount = records.reduce((sum, r) => sum + (r.people_count || 0), 0) / records.length;

      // Promedio de tiempo de procesamiento
      stats.avgProcessingTime = records.reduce((sum, r) => sum + (r.processing_time || 0), 0) / records.length;

      // Objetos más comunes
      const objectCounts: Record<string, number> = {};
      records.forEach(record => {
        if (record.detected_objects && Array.isArray(record.detected_objects)) {
          record.detected_objects.forEach((obj: string) => {
            objectCounts[obj] = (objectCounts[obj] || 0) + 1;
          });
        }
      });

      stats.mostCommonObjects = Object.entries(objectCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([obj]) => obj);
    }

    // Formatear registros para el cliente
    const formattedRecords = records.map(record => ({
      id: record.id,
      timestamp: record.created_at,
      people_count: record.people_count || 0,
      group_type: record.group_type || 'desconocido',
      detected_objects: record.detected_objects || [],
      confidence_score: record.confidence_score || 0,
      processing_time: record.processing_time || 0,
      snapshot_url: record.snapshot_url,
    }));

    return NextResponse.json({
      records: formattedRecords,
      stats,
    });
  } catch (error) {
    console.error('Error en /api/vision/records:', error);
    return NextResponse.json(
      { error: 'Error al procesar solicitud' },
      { status: 500 }
    );
  }
}

/**
 * Endpoint DELETE para limpiar registros antiguos
 */
export async function DELETE() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Eliminar registros más antiguos de 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error } = await supabase
      .from('vision_analysis_records')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('Error al eliminar registros antiguos:', error);
      return NextResponse.json(
        { error: 'Error al eliminar registros' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Registros antiguos eliminados',
    });
  } catch (error) {
    console.error('Error en DELETE /api/vision/records:', error);
    return NextResponse.json(
      { error: 'Error al procesar solicitud' },
      { status: 500 }
    );
  }
}
