import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('📡 GET /api/admin/users - Starting...');
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener perfiles
    console.log('📚 Fetching profiles from database...');
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profileError) {
      console.error('❌ Error fetching profiles:', profileError);
      return NextResponse.json({ error: `Error fetching profiles: ${profileError.message}` }, { status: 500 });
    }

    console.log('✅ Profiles fetched:', profiles?.length || 0);

    // Intentar obtener usuarios de auth para obtener emails
    const authEmails: Map<string, string> = new Map();
    try {
      const { data: { users = [] }, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000
      });
      
      if (!authError) {
        users.forEach(u => {
          if (u.email) {
            authEmails.set(u.id, u.email);
          }
        });
        console.log('✅ Auth users fetched:', authEmails.size);
      } else {
        console.warn('⚠️ Could not fetch auth users:', authError.message);
      }
    } catch (authErr) {
      console.warn('⚠️ Exception fetching auth users:', String(authErr));
    }

    // Combinar datos
    const usersWithEmails = (profiles || []).map((profile: Record<string, unknown>) => {
      const email = authEmails.get(profile.id as string) || (profile.email as string) || 'No disponible';
      return {
        ...profile,
        email
      };
    });

    console.log('✅ Returning', usersWithEmails.length, 'users');
    return NextResponse.json(usersWithEmails);
  } catch (error) {
    console.error('❌ Error in GET /api/admin/users:', error);
    return NextResponse.json(
      { error: `Error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
