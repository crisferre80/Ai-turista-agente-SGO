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

  // Build payload according to OneSignal Email API requirements (POST /notifications?c=email)
  const payload = {
    app_id: appId,
    email_subject: template.subject || template.name || 'No subject',
    email_body: template.html || template.subject || '<p></p>',
    // Keep contents for backward compatibility, but main fields are email_subject/email_body
    contents: { en: template.subject || template.name || '' },
    // Targeting: by default send to subscribed users; you can override with email_to or include_aliases
    included_segments: ['Subscribed Users']
  };

  // Diagnostic: log non-sensitive payload info to help debug parsing errors
  try {
    console.debug('OneSignal send (email): app_id present=', !!appId, 'payloadKeys=', Object.keys(payload));
  } catch { /* ignore logging errors */ }

  // Use the documented API host + query param for email
  const url = 'https://api.onesignal.com/notifications?c=email';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Key ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  let json: unknown = text;
  try { json = text ? JSON.parse(text) : text; } catch { /* not JSON */ }
  if (!res.ok) throw new Error(`OneSignal API error ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  return json as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const { campaign_id } = await request.json();
    if (!campaign_id) return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 });

    const admin = getAdmin();

    const { data: campaign, error: cErr } = await admin.from('email_campaigns').select('*').eq('id', campaign_id).single();
    if (cErr) throw cErr;
    const campaignRec = campaign as CampaignRecord | null;
    if (!campaignRec) throw new Error('Campaign not found');

    const { data: tpl, error: tErr } = await admin.from('email_templates').select('*').eq('id', campaignRec.template_id).single();
    if (tErr) throw tErr;
    const tplRec = tpl as TemplateRecord | null;
    if (!tplRec) throw new Error('Template not found');

    let r: Record<string, unknown> | null = null;
    try {
      r = await sendViaOneSignal(tplRec);
      await admin.from('email_campaigns').update({ status: 'sent', external_id: (r as Record<string, unknown>).id ?? null }).eq('id', campaignRec.id);
      return NextResponse.json({ ok: true, result: r });
    } catch (sendErr: unknown) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      console.error('Failed to send campaign via OneSignal:', msg);
      await admin.from('email_campaigns').update({ status: 'failed' }).eq('id', campaignRec.id);
      return NextResponse.json({ error: 'OneSignal send failed: ' + msg }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
