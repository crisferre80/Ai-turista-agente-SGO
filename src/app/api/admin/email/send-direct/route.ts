import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  return createClient(url, key, { auth: { persistSession: false } });
};

export async function POST(request: Request) {
  try {
    const { emails, subject, html } = await request.json();
    if (!emails || !Array.isArray(emails) || emails.length === 0) return NextResponse.json({ error: 'emails array required' }, { status: 400 });

    const apiKey = process.env.ONESIGNAL_REST_KEY;
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID;
    if (!apiKey || !appId) throw new Error('OneSignal not configured');

    const payload = {
      app_id: appId,
      email_subject: subject || 'Mensaje desde la app',
      email_body: html || '<p></p>',
      email_to: emails.slice(0, 20000),
    };

    const url = 'https://api.onesignal.com/notifications?c=email';
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` }, body: JSON.stringify(payload) });
    const text = await res.text();
    let json: unknown = text;
    try { json = text ? JSON.parse(text) : text; } catch { /* ignore */ }
    if (!res.ok) throw new Error(`OneSignal error ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);

    return NextResponse.json({ ok: true, result: json });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
