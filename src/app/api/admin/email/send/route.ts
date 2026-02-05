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

    // Get subscribed contacts
    const { data: contacts } = await admin.from('email_contacts').select('email').eq('subscribed', true);
    const recipients = contacts?.map(c => c.email) || [];

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No subscribers found' }, { status: 400 });
    }

    try {
      const result = await sendViaGmail(tplRec, recipients);
      
      if (result.success) {
        await admin.from('email_campaigns').update({ 
          status: 'sent', 
          external_id: result.messageId || null 
        }).eq('id', campaignRec.id);
        
        return NextResponse.json({ ok: true, sentCount: result.sentCount, messageId: result.messageId });
      } else {
        throw new Error(result.error || 'Failed to send emails');
      }
    } catch (sendErr: unknown) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      console.error('Failed to send campaign via Gmail:', msg);
      await admin.from('email_campaigns').update({ status: 'failed' }).eq('id', campaignRec.id);
      return NextResponse.json({ error: 'Gmail send failed: ' + msg }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
