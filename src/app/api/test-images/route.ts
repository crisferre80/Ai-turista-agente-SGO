import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: files, error } = await supabase.storage
      .from('images')
      .list('', { limit: 5 });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filesWithUrls = files?.map(file => {
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(file.name);

      return {
        name: file.name,
        url: urlData.publicUrl,
        size: file.metadata?.size,
        type: file.metadata?.mimetype
      };
    });

    return NextResponse.json({ files: filesWithUrls });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}