import { NextResponse } from 'next/server';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  const apiKey = process.env.ONESIGNAL_REST_KEY || process.env.NEXT_PUBLIC_ONESIGNAL_REST_KEY;
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID;
  if (!apiKey || !appId) return NextResponse.json({ error: 'OneSignal env vars not configured' }, { status: 500 });

  const payload = {
    app_id: appId,
    included_segments: ['Subscribed Users'],
    contents: { en: 'Test message from onesignal-test endpoint' },
    email_subject: 'Test email subject',
    email_body: '<p>Test email body</p>'
  };

  try {
    console.debug('onesignal-test: app_id present=', !!appId, 'payloadKeys=', Object.keys(payload));
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Basic ${apiKey}` },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let json: unknown = text;
    try { json = text ? JSON.parse(text) : text; } catch { /* ignore */ }

    if (!res.ok) return NextResponse.json({ ok: false, status: res.status, body: json }, { status: 500 });

    return NextResponse.json({ ok: true, status: res.status, body: json });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
