import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  return createClient(url, key, { auth: { persistSession: false } });
};

type TemplateRecord = { id?: string; name?: string; subject?: string; html?: string; [key: string]: unknown };
type CampaignRecord = { id?: string; name?: string; template_id?: string; status?: string; external_id?: string | null; [key: string]: unknown };

async function sendViaOneSignal(template: TemplateRecord): Promise<Record<string, unknown>> {
  const apiKey = process.env.ONESIGNAL_REST_KEY || process.env.NEXT_PUBLIC_ONESIGNAL_REST_KEY;
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID;
  if (!apiKey || !appId) throw new Error('OneSignal API key or App ID not configured');

  const payload = {
    app_id: appId,
    email_subject: template.subject || template.name || 'No subject',
    email_body: template.html || template.subject || '<p></p>',
    contents: { en: template.subject || template.name || '' },
    included_segments: ['Subscribed Users']
  };

  try { console.debug('OneSignal send (email, campaigns): app_id present=', !!appId, 'payloadKeys=', Object.keys(payload)); } catch {}

  const url = 'https://api.onesignal.com/notifications?c=email';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Accept': 'application/json',
      'Authorization': `Key ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

export async function GET() {
  try {
    const admin = getAdmin();
    const { data, error } = await admin.from('email_campaigns').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ ok: true, campaigns: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, template_id, sendNow } = body;
    if (!name || !template_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const admin = getAdmin();

    const { data: tpl, error: tplErr } = await admin.from('email_templates').select('*').eq('id', template_id).single();
    if (tplErr) throw tplErr;
    const tplRec = tpl as TemplateRecord | null;
    if (!tplRec) throw new Error('Template not found');

    const { data: inserted, error: insErr } = await admin.from('email_campaigns').insert([{ name, template_id, status: 'pending' }]).select().single();
    if (insErr) throw insErr;
    const insertedRec = inserted as CampaignRecord;

    let sendResult: Record<string, unknown> | null = null;
    if (sendNow) {
      try {
        const r = await sendViaOneSignal(tpl);
        sendResult = r;
        await admin.from('email_campaigns').update({ status: 'sent', external_id: (r as Record<string, unknown>).id ?? null }).eq('id', insertedRec.id);
      } catch (sendErr: unknown) {
        await admin.from('email_campaigns').update({ status: 'failed' }).eq('id', insertedRec.id);
        const sMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        return NextResponse.json({ error: sMsg, campaign: insertedRec });
      }
    }

    return NextResponse.json({ ok: true, campaign: insertedRec, sendResult });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
