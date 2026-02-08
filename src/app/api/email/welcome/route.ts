import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTemplateEmail } from '@/lib/email';

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  return createClient(url, key, { auth: { persistSession: false } });
};

// Public endpoint called after registration to send welcome email and register contact
export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    const admin = getAdmin();

    // Find welcome template (prefer profile/business template if found)
    const { data: templates } = await admin.from('email_templates').select('*').order('created_at', { ascending: false });
    type TemplateRow = { id?: string; name?: string; subject?: string; html?: string };
    const welcomeTpl = (templates || []).find((t: TemplateRow) => String(t.name).toLowerCase().includes('bienvenida')) as TemplateRow | undefined || (templates || [])[0];

    if (!welcomeTpl) return NextResponse.json({ error: 'No welcome template available' }, { status: 500 });

    // Personalize template simple token replacement
    const personalizedHtml = (welcomeTpl.html || '').replace(/{{\s*name\s*}}/gi, name || '');
    const personalizedSubject = (welcomeTpl.subject || '').replace(/{{\s*name\s*}}/gi, name || '');

    // Send via Mailjet
    const result = await sendTemplateEmail(
      email,
      personalizedSubject || 'Bienvenido',
      personalizedHtml || personalizedSubject
    );

    if (!result.success) {
      return NextResponse.json({ error: `Mailjet error: ${result.error}` }, { status: 500 });
    }

    // Upsert contact into email_contacts table for tracking
    try {
      const { data: existing } = await admin.from('email_contacts').select('*').eq('email', email).limit(1).maybeSingle();
      if (!existing) {
        await admin.from('email_contacts').insert([{ name: name || null, email }]);
      }
    } catch { /* don't block on db error */ }

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
