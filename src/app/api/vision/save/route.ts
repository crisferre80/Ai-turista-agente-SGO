import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * API endpoint para guardar análisis de visión en la base de datos
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await request.formData();
    const analysisStr = formData.get('analysis') as string;
    const snapshotBlob = formData.get('snapshot') as Blob;

    if (!analysisStr) {
      return NextResponse.json(
        { error: 'No se proporcionó análisis' },
        { status: 400 }
      );
    }

    const analysis = JSON.parse(analysisStr);

    // Subir snapshot a Supabase Storage si se proporcionó
    let snapshotUrl: string | undefined;
    if (snapshotBlob) {
      const timestamp = Date.now();
      const fileName = `vision-analysis-${timestamp}.jpg`;
      const arrayBuffer = await snapshotBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('vision-snapshots')
        .upload(fileName, buffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error al subir snapshot:', uploadError);
      } else if (uploadData) {
        const { data: urlData } = supabase.storage
          .from('vision-snapshots')
          .getPublicUrl(fileName);
        snapshotUrl = urlData.publicUrl;
      }
    }

    // Insertar registro en la base de datos
    const { data, error } = await supabase
      .from('vision_analysis_records')
      .insert({
        people_count: analysis.people_count || 0,
        group_type: analysis.group_type || 'solo',
        detected_objects: analysis.detected_objects || [],
        confidence_score: analysis.confidence_score || 0,
        processing_time: Math.round(analysis.processing_time || 0),
        snapshot_url: snapshotUrl,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al guardar análisis:', error);
      return NextResponse.json(
        { error: 'Error al guardar en base de datos' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      record: data,
    });
  } catch (error) {
    console.error('Error en /api/vision/save:', error);
    return NextResponse.json(
      { error: 'Error al procesar solicitud' },
      { status: 500 }
    );
  }
}
