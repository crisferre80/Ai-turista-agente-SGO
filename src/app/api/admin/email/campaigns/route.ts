import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTemplateEmail } from '@/lib/gmail';

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  return createClient(url, key, { auth: { persistSession: false } });
};

type TemplateRecord = { id?: string; name?: string; subject?: string; html?: string; [key: string]: unknown };
type CampaignRecord = { id?: string; name?: string; template_id?: string; status?: string; external_id?: string | null; [key: string]: unknown };

async function sendViaGmail(template: TemplateRecord, recipients: string[]): Promise<{ success: boolean; messageId?: string; error?: string; sentCount: number }> {
  let sentCount = 0;
  let lastMessageId: string | undefined;
  let lastError: string | undefined;

  for (const email of recipients) {
    const result = await sendTemplateEmail(
      email,
      template.subject || template.name || 'No subject',
      template.html || '<p></p>'
    );

    if (result.success) {
      sentCount++;
      lastMessageId = result.messageId;
    } else {
      lastError = result.error;
      console.error(`Failed to send email to ${email}:`, result.error);
    }
  }

  return {
    success: sentCount > 0,
    messageId: lastMessageId,
    error: sentCount === 0 ? lastError : undefined,
    sentCount
  };
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

    let sendResult: { success: boolean; sentCount?: number; messageId?: string; error?: string } | null = null;
    if (sendNow) {
      try {
        // Get subscribed contacts
        const { data: contacts } = await admin.from('email_contacts').select('email').eq('subscribed', true);
        const recipients = contacts?.map(c => c.email) || [];
        
        if (recipients.length === 0) {
          throw new Error('No subscribers found');
        }

        const r = await sendViaGmail(tplRec, recipients);
        sendResult = r;
        
        if (r.success) {
          await admin.from('email_campaigns').update({ status: 'sent', external_id: r.messageId ?? null }).eq('id', insertedRec.id);
        } else {
          throw new Error(r.error || 'Failed to send emails');
        }
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
